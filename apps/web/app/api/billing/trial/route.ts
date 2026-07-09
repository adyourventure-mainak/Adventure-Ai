import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, grantWelcomeCredits } from "@adventure/db";
import { PLANS, TRIAL_DAYS, TRIAL_PRICE_PAISE } from "@adventure/core";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";

const Input = z.object({ slug: z.string() });

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

  // BILLING_TEST_MODE=1: activate without payment while Razorpay website
  // verification is pending. Remove the env var to restore real checkout.
  if (process.env.BILLING_TEST_MODE === "1") {
    const plan = PLANS.TRIAL;
    await prisma.$transaction([
      prisma.company.update({
        where: { id: company.id },
        data: {
          planTier: "TRIAL",
          taskCyclesPerDay: plan.taskCyclesPerDay,
          status: "PROVISIONING",
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          lapsedAt: null,
        },
      }),
      prisma.activityLog.create({
        data: {
          companyId: company.id,
          agent: "FINANCE",
          action: "Trial activated (billing test mode — no charge)",
          isPublic: false,
        },
      }),
    ]);
    await grantWelcomeCredits(company.id);
    return NextResponse.json({ activated: true, companyName: company.name });
  }

  const order = await razorpay.createOrder({
    amountPaise: TRIAL_PRICE_PAISE,
    receipt: `trial-${company.id.slice(-12)}-${Date.now()}`,
    notes: {
      type: "trial",
      companyId: company.id,
      userEmail: user.email,
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amountPaise: TRIAL_PRICE_PAISE,
    companyName: company.name,
  });
}
