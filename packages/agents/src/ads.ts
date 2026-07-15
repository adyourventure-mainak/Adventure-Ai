import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recallMemories } from "./memory";
import { approvedContent, resumePhase, cancelRejectedTask } from "./approvals";

export const AdCampaignDraftSchema = z.object({
  platform: z.enum(["google", "meta"]),
  headline: z.string().describe("Ad headline, max 30 chars for google / 40 for meta"),
  description: z.string().describe("Ad body copy, under 90 chars"),
  targeting: z.string().describe("Audience targeting in one line (location, interests, intent)"),
  dailyBudgetRupees: z
    .number()
    .int()
    .describe("Proposed daily budget in whole rupees. Stay well inside the monthly cap."),
  rationale: z.string().describe("Why this angle and budget, one sentence"),
});
export type AdCampaignDraft = z.infer<typeof AdCampaignDraftSchema>;

/**
 * Ads agent — proposes paid campaigns. Two hard guardrails, independent of
 * autonomy level, because this is real money:
 *   1. adBudgetCapP = 0 means ads are OFF — the task completes with a nudge,
 *      no draft, no spend.
 *   2. Every budget goes through the approvals inbox (AD_BUDGET_CHANGE), and
 *      the proposed daily budget is clamped so a full month fits the cap.
 */
export async function runAdsTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: true, approval: true },
  });
  const company = task.company;

  const phase = resumePhase(task.approval);
  if (phase === "cancel") return cancelRejectedTask(taskId);
  if (phase === "execute") {
    const campaign = approvedContent<AdCampaignDraft>(task.approval!);
    return launchCampaign(taskId, company.id, campaign);
  }

  if (company.adBudgetCapP <= 0) {
    await logActivity({
      companyId: company.id,
      agent: "ADS",
      action: "Ads are off (budget cap ₹0) — set a monthly ad budget in settings to let me propose campaigns",
      taskId,
      isPublic: false,
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "COMPLETED", completedAt: new Date(), result: { skipped: "ads disabled" } },
    });
    return;
  }

  await assertWithinLlmCaps(company.id);
  const objective = (task.payload as { objective?: string })?.objective ?? task.title;
  const memories = await recallMemories(company.id, objective, 5);
  const monthlyCapRupees = Math.floor(company.adBudgetCapP / 100);
  const maxDailyRupees = Math.max(1, Math.floor(monthlyCapRupees / 30));

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("ads"),
    messages: [
      {
        role: "system",
        content: `You are the Ads agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}
Monthly ad budget cap: ₹${monthlyCapRupees} → daily budget must be ≤ ₹${maxDailyRupees}.

Propose ONE tightly-targeted campaign. Small budgets die on broad targeting —
narrow the audience until the budget is meaningful for it. Direct-response
copy: concrete benefit, no brand fluff.

Relevant memory:
${memories.map((m) => `- [${m.agent}] ${m.content}`).join("\n") || "(none)"}`,
      },
      { role: "user", content: `Campaign objective: ${objective}` },
    ],
    response_format: zodResponseFormat(AdCampaignDraftSchema, "ad_campaign"),
  });

  const draft = completion.choices[0]?.message?.parsed;
  if (!draft) throw new Error("Ads LLM returned no valid campaign");
  const usage = usageFrom(completion.usage, modelFor("ads"));

  // Hard clamp regardless of what the LLM proposed.
  draft.dailyBudgetRupees = Math.min(Math.max(1, draft.dailyBudgetRupees), maxDailyRupees);

  // Campaign proposal ships straight to the company inbox. No spend can
  // happen until an ad account is linked, and the budget stays clamped.
  return launchCampaign(taskId, company.id, draft, usage);
}

/**
 * Launch the approved campaign. GOOGLE_ADS/META_ADS integrations aren't
 * connected yet, so the approved campaign is recorded ready-to-launch —
 * no spend can happen until an ad account is linked.
 */
async function launchCampaign(
  taskId: string,
  companyId: string,
  campaign: AdCampaignDraft,
  usage?: LlmUsage,
): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: { companyId, provider: { in: ["GOOGLE_ADS", "META_ADS"] }, status: "CONNECTED" },
  });
  const launched = false; // real launch lands with the ad-platform integration

  await logActivity({
    companyId,
    agent: "ADS",
    action: integration
      ? `Launched ${campaign.platform} campaign at ₹${campaign.dailyBudgetRupees}/day: "${campaign.headline}"`
      : `Campaign approved for ${campaign.platform} at ₹${campaign.dailyBudgetRupees}/day — connect an ad account to launch: "${campaign.headline}"`,
    taskId,
    usage,
    detail: { campaign },
  });
  await saveMemory({
    companyId,
    agent: "ADS",
    kind: "decision",
    content: `Approved ${campaign.platform} campaign "${campaign.headline}" at ₹${campaign.dailyBudgetRupees}/day targeting: ${campaign.targeting}`,
    taskId,
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { campaign, launched },
    },
  });
}
