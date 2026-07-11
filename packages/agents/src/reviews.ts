import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai, model, usageFrom, type LlmUsage } from "./llm";

/**
 * Scan the owner's Google My Business / Maps page and pull the top ratings
 * and reviews to feature on the company website.
 */

export interface GmbReview {
  author: string;
  rating: number; // 1..5
  text: string;
}

const ExtractionSchema = z.object({
  reviews: z
    .array(
      z.object({
        author: z.string().describe("Reviewer's display name as shown"),
        rating: z.number().int().min(1).max(5).describe("Star rating the reviewer gave"),
        text: z.string().describe("The review text, verbatim (trim to ~300 chars if longer)"),
      }),
    )
    .max(3)
    .describe("Up to 3 of the BEST reviews found (highest rating, most substantive text). Empty if none found."),
});

const GMB_HOSTS = [
  "google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "g.co",
  "g.page",
  "goo.gl",
  "share.google",
  "business.google.com",
];

/** Validate that a link plausibly points at a Google Business/Maps profile. */
export function isGmbUrl(raw: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "");
    return GMB_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Fetch the GMB page and LLM-extract the top 3 reviews. Google renders most
 * reviews client-side, but share links embed an initial payload that usually
 * contains the top ones — extraction is best-effort and returns [] when the
 * page gives us nothing usable.
 */
export async function extractGmbReviews(rawUrl: string): Promise<{ reviews: GmbReview[]; usage: LlmUsage }> {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Google returned ${res.status} for that link`);
  const html = await res.text();
  // Keep raw text INCLUDING embedded JSON payloads (that's where reviews live),
  // just strip tags/styles to fit the context window.
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60_000);

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You extract customer reviews from the raw text/JSON of a Google Business or Google Maps page.
Return up to 3 of the best genuine customer reviews (prefer 5-star with substantive text; skip owner replies, UI labels, and anything that isn't clearly a customer review). Use the reviewer's name exactly as shown. If no genuine reviews are present in the content, return an empty list — never invent reviews.`,
      },
      { role: "user", content: text },
    ],
    response_format: zodResponseFormat(ExtractionSchema, "gmb_reviews"),
  });
  const parsed = completion.choices[0]?.message?.parsed;
  return { reviews: parsed?.reviews ?? [], usage: usageFrom(completion.usage) };
}
