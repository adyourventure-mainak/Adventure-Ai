import { prisma } from "./client";

/** Canonical stored form of a coupon code (kept in sync with @adventure/core). */
function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export type CouponCheck =
  | { ok: true; coupon: { id: string; code: string; percentOff: number; freeDays: number } }
  | { ok: false; error: string };

/**
 * Validate a user-typed coupon code for a given owner. Checks existence,
 * active flag, expiry, per-owner restriction, and remaining redemptions —
 * WITHOUT consuming it. Redemption is recorded separately, atomically, at the
 * point the discount/comp is actually granted.
 */
export async function validateCoupon(rawCode: string, userEmail: string): Promise<CouponCheck> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, error: "That coupon isn't valid." };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { ok: false, error: "That coupon has expired." };
  }
  if (coupon.allowedEmail && coupon.allowedEmail.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, error: "This coupon is reserved for a different account." };
  }
  if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { ok: false, error: "This coupon has already been fully used." };
  }
  return {
    ok: true,
    coupon: { id: coupon.id, code: coupon.code, percentOff: coupon.percentOff, freeDays: coupon.freeDays },
  };
}

/**
 * Atomically consume one redemption and write the audit row. The conditional
 * update (redemptionCount guard) makes concurrent redemptions safe: if the
 * coupon has a cap and it's already hit, the update matches nothing and we
 * throw rather than over-grant.
 */
export async function recordRedemption(params: {
  couponId: string;
  userId: string;
  companyId: string;
  appliedTo: "PRO_COMP" | "TRIAL" | "CREDITS";
  amountOffP?: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.coupon.updateMany({
      where: {
        id: params.couponId,
        active: true,
        OR: [
          { maxRedemptions: null },
          { redemptionCount: { lt: prisma.coupon.fields.maxRedemptions } },
        ],
      },
      data: { redemptionCount: { increment: 1 } },
    });
    if (updated.count === 0) throw new Error("Coupon is no longer redeemable");
    await tx.couponRedemption.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        companyId: params.companyId,
        appliedTo: params.appliedTo,
        amountOffP: params.amountOffP ?? 0,
      },
    });
  });
}
