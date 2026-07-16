import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, grantWelcomeCredits, validateCoupon, recordRedemption } from "@adventure/db";
import { PLANS } from "@adventure/core";
import { getUser } from "@/lib/auth";

const Input = z.object({ code: z.string().min(1).max(40) });

/**
 * Redeem or preview a coupon on a company.
 *  - 100% coupon → comps the company onto full access (TRIAL-tier machinery)
 *    for the coupon's freeDays, immediately. Redemption recorded here.
 *  - 50% / 70% coupon → NOT consumed here; returns the discount so the client
 *    can apply it at trial/credit checkout (redeemed on payment success).
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a coupon code." }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true, name: true, status: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const check = await validateCoupon(parsed.data.code, user.email);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const { coupon } = check;

  // Partial discounts are applied at checkout, not here.
  if (coupon.percentOff !== 100) {
    return NextResponse.json({
      kind: "discount",
      code: coupon.code,
      percentOff: coupon.percentOff,
    });
  }

  // 100% → comp full access for freeDays via the trial machinery.
  const trialEndsAt = new Date(Date.now() + coupon.freeDays * 24 * 60 * 60 * 1000);
  try {
    await recordRedemption({
      couponId: coupon.id,
      userId: user.id,
      companyId: company.id,
      appliedTo: "PRO_COMP",
    });
  } catch {
    return NextResponse.json({ error: "That coupon has just been fully used." }, { status: 409 });
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      planTier: "TRIAL", // TRIAL tier = full Pro-level access
      status: company.status === "ACTIVE" ? "ACTIVE" : "PROVISIONING",
      taskCyclesPerDay: PLANS.TRIAL.taskCyclesPerDay,
      trialEndsAt,
      lapsedAt: null,
    },
  });
  await grantWelcomeCredits(company.id);
  await prisma.activityLog.create({
    data: {
      companyId: company.id,
      agent: "FINANCE",
      action: `Coupon ${coupon.code} applied — ${coupon.freeDays} days of full access unlocked, free`,
      isPublic: false,
    },
  });

  return NextResponse.json({ kind: "comp", freeDays: coupon.freeDays, companyName: company.name });
}
