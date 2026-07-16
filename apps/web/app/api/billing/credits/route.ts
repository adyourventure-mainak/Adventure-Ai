import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, grantCredits, validateCoupon, recordRedemption } from "@adventure/db";
import { CREDIT_PACKS, applyCouponToBase, withGst, gstOn } from "@adventure/core";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";
import { billingTestMode } from "@/lib/billing";

const Input = z.object({
  slug: z.string(),
  credits: z.number().int(),
  couponCode: z.string().max(40).optional(),
});

/**
 * Create a Razorpay Order for a credit pack. The webhook's payment.captured
 * handler grants the credits (notes.type = "credit_pack"), so a lost checkout
 * callback can't lose a purchase.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const pack = CREDIT_PACKS.find((p) => p.credits === parsed.data.credits);
  if (!pack) return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true, name: true, ownerId: true, planTier: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.planTier === "FREE") {
    return NextResponse.json({ error: "Credits are for paid plans — upgrade first." }, { status: 403 });
  }

  // Optional coupon → discount the pre-tax base. GST applies to the net.
  let couponId: string | null = null;
  let base: number = pack.pricePaise;
  if (parsed.data.couponCode?.trim()) {
    const check = await validateCoupon(parsed.data.couponCode, user.email);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    couponId = check.coupon.id;
    base = applyCouponToBase(base, check.coupon.percentOff);
  }
  const amountP = withGst(base);

  // Fully-discounted (100% coupon) or test mode → grant free, no Razorpay order.
  if (base <= 0 || billingTestMode()) {
    if (couponId) {
      try {
        await recordRedemption({
          couponId,
          userId: user.id,
          companyId: company.id,
          appliedTo: "CREDITS",
          amountOffP: pack.pricePaise - base,
        });
      } catch {
        return NextResponse.json({ error: "That coupon has just been fully used." }, { status: 409 });
      }
    }
    await grantCredits(
      company.id,
      pack.credits,
      couponId
        ? `Credit pack (coupon applied, ${pack.credits} credits)`
        : `Credit pack (billing test mode — no charge, ${pack.credits} credits)`,
    );
    return NextResponse.json({ activated: true, credits: pack.credits, companyName: company.name });
  }

  const order = await razorpay.createOrder({
    amountPaise: amountP,
    receipt: `credits-${company.id.slice(-12)}-${Date.now()}`,
    notes: {
      type: "credit_pack",
      companyId: company.id,
      credits: String(pack.credits),
      ...(couponId ? { couponId } : {}),
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amountPaise: amountP,
    baseP: base,
    gstP: gstOn(base),
    credits: pack.credits,
    companyName: company.name,
  });
}
