import { zodResponseFormat } from "openai/helpers/zod";
import { AdPlanSchema, type AdPlan } from "@adventure/core";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";

export interface AdPlanResult {
  adPlan: AdPlan;
  usage: LlmUsage;
}

/**
 * Generate a 30-day advertisement plan with audience-segment and competitor
 * research for a paid company. Pure LLM call — the caller persists it on
 * CompanyPlan.adPlan and gates access by plan tier.
 */
export async function generateAdPlan(input: {
  companyName: string;
  ideaSummary: string;
  positioning: string;
  brandVoice: string;
  adBudgetCapPaise?: number;
}): Promise<AdPlanResult> {
  const budgetLine =
    input.adBudgetCapPaise && input.adBudgetCapPaise > 0
      ? `Monthly ad budget cap: ₹${Math.round(input.adBudgetCapPaise / 100)}.`
      : "No ad budget configured yet — plan should work for a small starter budget (₹3,000–₹10,000/month) and note where to spend first.";

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("adplan"),
    messages: [
      {
        role: "system",
        content:
          "You are a senior performance-marketing strategist for early-stage Indian online businesses. " +
          "Produce a realistic, specific 30-day advertisement plan: research-grounded audience segments, " +
          "a competitor teardown with counter-positioning ad angles, and a week-by-week ad calendar. " +
          "Channels should be practical for a small budget in India (Meta/Instagram, Google Search, " +
          "WhatsApp, LinkedIn where B2B). Budget percentages across all calendar entries must sum to roughly 100.",
      },
      {
        role: "user",
        content:
          `Company: ${input.companyName}\n` +
          `What it does: ${input.ideaSummary}\n` +
          `Positioning: ${input.positioning}\n` +
          `Brand voice: ${input.brandVoice}\n` +
          budgetLine,
      },
    ],
    response_format: zodResponseFormat(AdPlanSchema, "ad_plan"),
  });

  const message = completion.choices[0]?.message;
  const adPlan = message?.parsed;
  if (!adPlan) throw new Error("Ad plan generation returned no parsed output");
  return { adPlan, usage: usageFrom(completion.usage, modelFor("adplan")) };
}
