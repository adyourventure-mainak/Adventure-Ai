import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, grantWelcomeCredits, validateCoupon, recordRedemption } from "@adventure/db";
import { PLANS, TRIAL_DAYS, TRIAL_PRICE_PAISE, applyCouponToBase, withGst, gstOn } from "@adventure/core";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";
import { billingTestMode } from "@/lib/billing";

const Input = z.object({ slug: z.string(), couponCode: z.string().max(40).optional() });

/**
 * Create a Razorpay Order for the paid trial (TRIAL_DAYS days). The webhook's
 * payment.captured handler activates the trial (notes.type = "trial"), so a
 * lost checkout callback can't lose a purchase. One-time payment — no mandate.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug: parsed.data.slug },
    include: { subscription: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.subscription?.status === "ACTIVE") {
    return NextResponse.json({ error: "This company already has an active subscription" }, { status: 409 });
  }
  // Eligible: legacy Free companies, or companies whose free/paid trial has
  // already expired. An active PRO plan (or a still-running trial) is not.
  const trialActive =
    company.planTier === "TRIAL" && company.trialEndsAt && company.trialEndsAt > new Date();
  if (company.planTier === "PRO" || company.planTier === "SCALE" || trialActive) {
    return NextResponse.json(
      { error: "This company already has an active plan or running trial" },
      { status: 409 },
    );
  }

  // Optional coupon → discount the pre-tax base. GST applies to the net.
  let couponId: string | null = null;
  let base: number = TRIAL_PRICE_PAISE;
  if (parsed.data.couponCode?.trim()) {
    const check = await validateCoupon(parsed.data.couponCode, user.email);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    couponId = check.coupon.id;
    base = applyCouponToBase(base, check.coupon.percentOff);
  }
  const amountP = withGst(base);

  // Fully-discounted (100% coupon) or test mode → activate free, no order.
  if (base <= 0 || billingTestMode()) {
    if (couponId) {
      try {
        await recordRedemption({
          couponId,
          userId: user.id,
          companyId: company.id,
          appliedTo: "TRIAL",
          amountOffP: TRIAL_PRICE_PAISE - base,
        });
      } catch {
        return NextResponse.json({ error: "That coupon has just been fully used." }, { status: 409 });
      }
    }
    await prisma.$transaction([
      prisma.company.update({
        where: { id: company.id },
        data: {
          planTier: "TRIAL",
          taskCyclesPerDay: PLANS.TRIAL.taskCyclesPerDay,
          status: "PROVISIONING",
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          lapsedAt: null,
        },
      }),
      prisma.activityLog.create({
        data: {
          companyId: company.id,
          agent: "FINANCE",
          action: couponId ? "Trial activated with coupon (no charge)" : "Trial activated (billing test mode — no charge)",
          isPublic: false,
        },
      }),
    ]);
    await grantWelcomeCredits(company.id);
    return NextResponse.json({ activated: true, companyName: company.name });
  }

  const order = await razorpay.createOrder({
    amountPaise: amountP,
    receipt: `trial-${company.id.slice(-12)}-${Date.now()}`,
    notes: {
      type: "trial",
      companyId: company.id,
      ...(couponId ? { couponId } : {}),
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amountPaise: amountP,
    baseP: base,
    gstP: gstOn(base),
    companyName: company.name,
  });
}
