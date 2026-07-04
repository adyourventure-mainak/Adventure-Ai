// Single source of truth for pricing and plan limits.
// All amounts in paise. RBI e-mandate rule: recurring mandates above
// ₹15,000 need extra authentication — keep plan prices below 1_500_000 paise.

export type PlanTier = "FREE" | "PRO" | "SCALE";

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
