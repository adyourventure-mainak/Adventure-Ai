import { zodResponseFormat } from "openai/helpers/zod";
import { CompanyFoundationSchema, type CompanyFoundation } from "@adventure/core";
import { openai, model, usageFrom, type LlmUsage } from "./llm";

const SYSTEM = `You are the founding strategist inside Adventure AI, an autonomous
platform that builds and operates online businesses for solo founders in India
and globally. Given a business idea (or asked to invent one), you produce the
company's foundation: name, positioning, brand voice, landing page copy, and a
realistic 30-day launch plan.

Guidelines:
- Names: short, brandable, available-sounding; avoid trademark-adjacent names.
- Positioning: specific target customer and a concrete wedge, not platitudes.
- Landing copy: punchy, benefit-led, no filler adjectives.
- 30-day plan: week-by-week, tasks an autonomous AI team (engineering, social,
  outreach, ads, research agents) can actually execute. Bias to shipping and
  first revenue, not "brand workshops".
- If inventing an idea: pick a validated, niche, low-capital online business
  (SaaS, productized service, niche marketplace, content+tools). Avoid
  crypto, gambling, and regulated categories.`;

export interface FoundationResult {
  foundation: CompanyFoundation;
  usage: LlmUsage;
}

export async function generateCompanyFoundation(input: {
  idea?: string;
  surprise: boolean;
}): Promise<FoundationResult> {
  const userPrompt = input.surprise
    ? "Invent a validated niche business idea and generate the full company foundation for it."
    : `Generate the full company foundation for this business idea:\n\n${input.idea}`;

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(CompanyFoundationSchema, "company_foundation"),
  });

  const message = completion.choices[0]?.message;
  const foundation = message?.parsed;
  if (!foundation) {
    const refusal = message?.refusal ? ` (refusal: ${message.refusal})` : "";
    throw new Error(`Company generation did not return valid output${refusal}`);
  }
  return { foundation, usage: usageFrom(completion.usage) };
}

/** URL-safe unique-ish slug from a company name. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
