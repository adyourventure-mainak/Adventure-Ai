// Single source of truth for pricing and plan limits.
// All amounts in paise. RBI e-mandate rule: recurring mandates above
// ₹15,000 need extra authentication — keep plan prices below 1_500_000 paise.

export type PlanTier = "FREE" | "TRIAL" | "PRO" | "SCALE";

// Limited-time launch offer: one-time ₹10 payment unlocks Pro-level access
// until this date (IST end of day). Purchase and access both end here.
export const TRIAL_ENDS_AT = new Date("2026-07-15T23:59:59.999+05:30");
export const TRIAL_PRICE_PAISE = 1000;

export function trialAvailable(now: Date = new Date()): boolean {
  return now < TRIAL_ENDS_AT;
}

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
      "One-time ₹10 — no mandate",
      "Valid till 15 July",
      "1 nightly task cycle / day",
    ],
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    pricePaise: 399900,
    taskCyclesPerDay: 1,
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
    features: [
      "Full autonomous operation",
      "All 9 agents",
      "1 nightly task cycle / day",
      "Hosting, DB, repo & email included",
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

export const CREDIT_PACKS = [
  { credits: 10, pricePaise: 80000 },
  { credits: 50, pricePaise: 360000 },
  { credits: 100, pricePaise: 640000 },
] as const;

/** Platform share of business revenue processed through Razorpay Route. */
export const REVENUE_SHARE_PERCENT = 20;

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
