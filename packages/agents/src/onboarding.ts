import { zodResponseFormat } from "openai/helpers/zod";
import {
  CompanyFoundationSchema,
  FOUNDATION_STEPS,
  type CompanyFoundation,
  type FoundationStepKey,
} from "@adventure/core";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";

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
  crypto, gambling, and regulated categories.
- Design: choose tokens that fit THIS business, not a default. Pick the accent
  color from the industry's visual language (e.g. food=warm reds/oranges,
  wellness=greens, legal/finance=deep blues, kids=bright playful hues) — do
  not default to blue, orange, or green every time. Match style + font to the
  audience: premium/boutique=elegant+serif, tech/SaaS=minimal or
  corporate+sans, kids/creators/food=playful+rounded, gyms/events=bold. If the
  owner's idea mentions any design preference, colors, or vibe, honor it
  exactly. Two different companies should never end up with the same look.`;

/** Extra guidance when the owner told us where they operate. */
function locationGuidance(location: string): string {
  return `

The owner operates in: ${location}.
Ground the company in THAT market, using what you know about it:
- Demand: what people there actually buy, realistic local price points and
  buying power. Do not propose a business the local market cannot sustain.
- Proven categories: favour business types with a real track record in or near
  ${location} over generic global templates. If you are inventing the idea
  ("surprise me"), pick something that demonstrably works in that region.
- Context: local competition, seasonality and festivals that drive demand,
  the languages customers use, and the channels/platforms they actually
  buy through.
- Copy: weave the location into positioning and landing copy where it earns
  local trust and search traffic — naturally, not stuffed. If the business is
  genuinely online-national, say so and don't force a local angle.
- The 30-day plan should use channels that work in ${location} specifically.
Be concrete about the place. Never invent statistics; reason from what you
actually know about the region.`;
}

export interface FoundationResult {
  foundation: CompanyFoundation;
  usage: LlmUsage;
}

export async function generateCompanyFoundation(input: {
  idea?: string;
  surprise: boolean;
  location?: string;
  /**
   * Fires as the model reaches each top-level field. Real progress, not a
   * timer — the caller streams these straight to the founder's screen.
   */
  onProgress?: (step: FoundationStepKey) => void;
}): Promise<FoundationResult> {
  const where = input.location?.trim();
  const userPrompt = input.surprise
    ? `Invent a validated niche business idea${where ? ` that works in ${where}` : ""} and generate the full company foundation for it.`
    : `Generate the full company foundation for this business idea:\n\n${input.idea}`;

  const stream = openai().beta.chat.completions.stream({
    model: modelFor("onboarding"),
    messages: [
      { role: "system", content: where ? SYSTEM + locationGuidance(where) : SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(CompanyFoundationSchema, "company_foundation"),
    // Streaming omits usage unless asked, and without it every onboarding call
    // would cost 0 — silently disabling the daily LLM spend cap.
    stream_options: { include_usage: true },
  });

  if (input.onProgress) {
    // Structured Outputs emit keys in schema order, so a key appearing in the
    // accumulated JSON means the model has started that field.
    const seen = new Set<string>();
    stream.on("content.delta", ({ snapshot }) => {
      for (const { key } of FOUNDATION_STEPS) {
        if (!seen.has(key) && snapshot.includes(`"${key}"`)) {
          seen.add(key);
          input.onProgress!(key);
        }
      }
    });
  }

  const completion = await stream.finalChatCompletion();
  const message = completion.choices[0]?.message;
  const foundation = message?.parsed;
  if (!foundation) {
    const refusal = message?.refusal ? ` (refusal: ${message.refusal})` : "";
    throw new Error(`Company generation did not return valid output${refusal}`);
  }
  return { foundation, usage: usageFrom(completion.usage, modelFor("onboarding")) };
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
