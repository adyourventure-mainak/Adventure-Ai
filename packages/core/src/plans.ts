// Single source of truth for pricing and plan limits.
// All amounts in paise. RBI e-mandate rule: recurring mandates above
// ₹15,000 need extra authentication — keep plan prices below 1_500_000 paise.

export type PlanTier = "FREE" | "TRIAL" | "PRO" | "SCALE";

// Trial: one-time payment unlocks Pro-level access for TRIAL_DAYS days
// (per-company expiry stored on Company.trialEndsAt).
export const TRIAL_PRICE_PAISE = 49900; // ₹499
export const TRIAL_DAYS = 7;
// One free trial per owner (by email): the first company gets FREE_TRIAL_DAYS
// of full access before any payment is asked; later companies must pay.
export const FREE_TRIAL_DAYS = 3;

export interface PlanDef {
  tier: PlanTier;
  name: string;
  pricePaise: number;
  taskCyclesPerDay: number;
  razorpayPlanEnv: string | null;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanDef> = {
  FREE: {
    tier: "FREE",
    name: "Free",
    pricePaise: 0,
    taskCyclesPerDay: 0,
    razorpayPlanEnv: null,
    features: [
      "1 company",
      "AI idea generation & validation",
      "30-day plan",
      "Landing page preview",
    ],
  },
  TRIAL: {
    tier: "TRIAL",
    name: "Trial",
    pricePaise: TRIAL_PRICE_PAISE,
    taskCyclesPerDay: 1,
    razorpayPlanEnv: null, // one-time order (notes.type = "trial"), not a subscription
    features: [
      "Everything in Pro",
      "One-time ₹499 — no mandate",
      "Valid for 7 days",
      "1 nightly task cycle / day",
    ],
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    pricePaise: 99900, // ₹999/mo
    taskCyclesPerDay: 1,
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
    features: [
      "Full autonomous operation",
      "All 9 agents",
      "1 nightly task cycle / day",
      "Hosting, DB, repo & email included",
      "8 on-demand credits included",
      "GitHub repo you own",
    ],
  },
  SCALE: {
    tier: "SCALE",
    name: "Scale",
    pricePaise: 799900,
    taskCyclesPerDay: 3,
    razorpayPlanEnv: "RAZORPAY_PLAN_SCALE",
    features: [
      "Everything in Pro",
      "3 task cycles / day",
      "Priority queue",
      "8 on-demand credits included",
      "Live chat support",
      "Custom domain included",
    ],
  },
};

/** Paid-tier perks enforced across web and worker. */
export type PlanPerk = "AD_PLAN" | "PRIORITY_QUEUE";

export function planAllows(tier: PlanTier, perk: PlanPerk): boolean {
  switch (perk) {
    case "AD_PLAN":
      return tier !== "FREE"; // any paying customer (incl. ₹10 trial)
    case "PRIORITY_QUEUE":
      return tier === "SCALE";
  }
}

/** BullMQ job priority (lower = sooner). Scale jumps the queue. */
export function queuePriority(tier: PlanTier): number {
  return planAllows(tier, "PRIORITY_QUEUE") ? 1 : 5;
}

/** Max companies a single tier entitles an owner to. */
export function companyLimitForTier(tier: PlanTier): number {
  // Hard platform cap: no account may create more than 5 companies.
  switch (tier) {
    case "SCALE":
    case "PRO":
    case "TRIAL":
      return 5;
    case "FREE":
      return 1;
  }
}

/**
 * How many companies an owner may have, given the plan tiers of the companies
 * they already own. Entitlement is the best tier they hold (a Scale company
 * lifts the whole account to 8); everyone can always create their first.
 */
export function companyLimitForOwner(ownedTiers: PlanTier[]): number {
  return Math.max(1, ...ownedTiers.map(companyLimitForTier));
}

export const CREDIT_PACKS = [
  { credits: 10, pricePaise: 9900 },   // ₹99
  { credits: 25, pricePaise: 19900 },  // ₹199
  { credits: 100, pricePaise: 39900 }, // ₹399
] as const;

// GST added on top of every charge (India, 18%). Prices above are pre-tax.
export const GST_PERCENT = 18;

/** GST amount (paise) on a pre-tax base. */
export function gstOn(basePaise: number): number {
  return Math.round((basePaise * GST_PERCENT) / 100);
}

/** Total the customer actually pays: base + GST, in paise. */
export function withGst(basePaise: number): number {
  return basePaise + gstOn(basePaise);
}

// Coupons discount the PRE-TAX base; GST then applies to the discounted base.
export const COUPON_PERCENTS = [50, 70, 100] as const;
export type CouponPercent = (typeof COUPON_PERCENTS)[number];

/** Normalise a user-typed coupon code to its canonical stored form. */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Pre-tax base after applying a percent-off coupon (paise, rounded). */
export function applyCouponToBase(basePaise: number, percentOff: number): number {
  return Math.round((basePaise * (100 - percentOff)) / 100);
}

/** Revenue-share model removed — platform keeps 0%. Route payouts (if any) transfer in full. */
export const REVENUE_SHARE_PERCENT = 0;

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
