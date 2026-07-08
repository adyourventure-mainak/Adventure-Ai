import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";

const Input = z.object({ slug: z.string() });

/**
 * Cancel the company's paid plan. Cancels the Razorpay subscription when one
 * exists (trial and test-mode activations have none), then lapses the company
 * into the 90-day retention window — same end state as the
 * subscription.cancelled webhook.
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
  if (company.planTier === "FREE") {
    return NextResponse.json({ error: "Nothing to cancel — this company is on the Free plan" }, { status: 409 });
  }

  const sub = company.subscription;
  if (sub && sub.status !== "CANCELLED" && sub.razorpaySubscriptionId) {
    try {
      await razorpay.cancelSubscription(sub.razorpaySubscriptionId);
    } catch (err) {
      // Already-cancelled/never-charged subscriptions can 400 on Razorpay's
      // side; the local state below is authoritative either way.
      console.error("[billing/cancel] razorpay cancel failed:", err);
    }
  }

  await prisma.$transaction([
    ...(sub
      ? [prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", cancelledAt: new Date() } })]
      : []),
    prisma.company.update({
      where: { id: company.id },
      data: { status: "LAPSED", taskCyclesPerDay: 0, lapsedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        companyId: company.id,
        agent: "FINANCE",
        action: "Plan cancelled by owner — agents stopped; data retained for 90 days",
        isPublic: false,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
