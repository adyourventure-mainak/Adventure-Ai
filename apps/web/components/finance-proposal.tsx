import { Badge } from "@/components/ui";

export type FinanceProposal = {
  platform: string;
  platformReason: string;
  monthlyAdBudgetRupees: number;
  assumptions: {
    costPerClickRupees: number;
    clicksPerMonth: number;
    conversionRatePercent: number;
    averageOrderValueRupees: number;
  };
  expectedMonthlyRevenueLowRupees: number;
  expectedMonthlyRevenueHighRupees: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta (Facebook)",
  google_search: "Google Search",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  none: "Not yet",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * The Finance agent's forward-looking growth proposal. Deliberately rendered
 * apart from actuals and labelled as an estimate — nothing here has been spent
 * or earned, and the workings are shown so the founder can judge it.
 */
export function FinanceProposalCard({
  proposal,
  adBudgetCapRupees,
}: {
  proposal: FinanceProposal;
  adBudgetCapRupees: number;
}) {
  const a = proposal.assumptions;
  const noAds = proposal.platform === "none" || proposal.monthlyAdBudgetRupees <= 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Ad budget proposal</h2>
        <Badge variant="outline" className="text-xs">projection — not actuals</Badge>
        <Badge
          variant="outline"
          className={`text-xs ${proposal.confidence === "low" ? "border-amber-500/40 text-amber-400" : ""}`}
        >
          {proposal.confidence} confidence
        </Badge>
      </div>
      <p className="mt-1 text-sm text-ink-400">
        Your Finance agent&apos;s estimate of where to start. Nothing is spent automatically —
        ads stay off until you set a budget cap and approve each campaign.
      </p>

      {noAds ? (
        <p className="mt-4 text-sm text-ink-100">{proposal.rationale}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-800 p-3">
              <div className="text-xs text-ink-400">Suggested spend</div>
              <div className="mt-1 text-lg font-semibold">{inr(proposal.monthlyAdBudgetRupees)}<span className="text-sm font-normal text-ink-400">/mo</span></div>
            </div>
            <div className="rounded-lg border border-ink-800 p-3">
              <div className="text-xs text-ink-400">Start on</div>
              <div className="mt-1 text-lg font-semibold">
                {PLATFORM_LABEL[proposal.platform] ?? proposal.platform}
              </div>
            </div>
            <div className="rounded-lg border border-ink-800 p-3">
              <div className="text-xs text-ink-400">Could return</div>
              <div className="mt-1 text-lg font-semibold">
                {inr(proposal.expectedMonthlyRevenueLowRupees)}–{inr(proposal.expectedMonthlyRevenueHighRupees)}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-ink-100">{proposal.platformReason}</p>

          {/* The workings, so the founder can sanity-check the projection. */}
          <div className="mt-4 rounded-lg border border-ink-800 bg-ink-950/50 p-3 text-xs text-ink-400">
            <span className="font-medium text-ink-100">How that&apos;s worked out: </span>
            {inr(proposal.monthlyAdBudgetRupees)} ÷ {inr(a.costPerClickRupees)} per click ≈{" "}
            {a.clicksPerMonth.toLocaleString("en-IN")} clicks → {a.conversionRatePercent}% convert →{" "}
            ~{Math.round((a.clicksPerMonth * a.conversionRatePercent) / 100).toLocaleString("en-IN")} customers ×{" "}
            {inr(a.averageOrderValueRupees)} order value.
          </div>

          <p className="mt-3 text-sm text-ink-400">{proposal.rationale}</p>

          {adBudgetCapRupees === 0 && (
            <p className="mt-3 text-xs text-amber-400">
              Ads are disabled — no budget cap is set on this company, so nothing will run until you set one.
            </p>
          )}
        </>
      )}
    </div>
  );
}
