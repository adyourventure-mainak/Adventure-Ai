import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { PLANS } from "@adventure/core";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";

const Input = z.object({
  slug: z.string(),
  tier: z.enum(["PRO", "SCALE"]),
});

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { slug, tier } = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug },
    include: { subscription: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.subscription?.status === "ACTIVE") {
    return NextResponse.json({ error: "This company already has an active subscription" }, { status: 409 });
  }

  const planEnv = PLANS[tier].razorpayPlanEnv!;
  const razorpayPlanId = process.env[planEnv];
  if (!razorpayPlanId) {
    return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
  }

  const sub = await razorpay.createSubscription({
    planId: razorpayPlanId,
    notes: { companyId: company.id, tier, userEmail: user.email },
  });

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      planTier: tier,
      razorpayPlanId,
      razorpaySubscriptionId: sub.id,
      status: "CREATED",
    },
    update: {
      planTier: tier,
      razorpayPlanId,
      razorpaySubscriptionId: sub.id,
      status: "CREATED",
      cancelledAt: null,
    },
  });

  return NextResponse.json({ subscriptionId: sub.id, companyName: company.name });
}
