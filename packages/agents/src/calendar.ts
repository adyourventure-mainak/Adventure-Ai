import { zodResponseFormat } from "openai/helpers/zod";
import { ContentCalendarSchema, type ContentCalendar } from "@adventure/core";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";

export interface ContentCalendarResult {
  calendar: ContentCalendar;
  usage: LlmUsage;
}

/** The three consecutive ISO dates the calendar should cover, from `from`. */
export function next3Days(from = new Date()): string[] {
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Generate a rolling 3-day social content calendar for a company, grounded in
 * its brand, market and the actual calendar dates. Pure LLM call — the caller
 * persists it on CompanyPlan.contentCalendar.
 *
 * Honesty guardrail: the model has no live trend feed, so it grounds each day
 * in things it CAN reason about (festivals/seasonality for the location,
 * industry moments, durable viral formats) and never invents a "currently
 * trending" hashtag or audio. It tells the founder to check live trends before
 * posting.
 */
export async function generateContentCalendar(input: {
  companyName: string;
  ideaSummary: string;
  positioning: string;
  brandVoice: string;
  location?: string | null;
  startDate?: Date;
}): Promise<ContentCalendarResult> {
  const dates = next3Days(input.startDate ?? new Date());
  const where = input.location?.trim();

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("calendar"),
    messages: [
      {
        role: "system",
        content:
          "You are a social media strategist for an early-stage Indian online business. " +
          "Produce a concrete, ready-to-use 3-day content calendar. Every post must fit the " +
          "brand voice and give the founder something they could publish today with light edits.\n\n" +
          "Ground each day in something REAL you can reason about:\n" +
          "- Festivals, observances and seasonal moments relevant to the company's location and " +
          "the specific dates given (India has many region-specific ones — use the location).\n" +
          "- Industry moments, buying cycles and evergreen customer questions.\n" +
          "- Durable, proven viral FORMATS (Reels hooks, carousels, before/after, polls, myth-busting) " +
          "rather than a specific song or meme.\n" +
          "You do NOT have live trend data, so never invent a 'currently trending' hashtag or audio. " +
          "If a day has no special occasion, make it a strong evergreen post — don't force a festival. " +
          "Vary platform and format across the three days; quality over quantity (1-2 posts/day).",
      },
      {
        role: "user",
        content:
          `Company: ${input.companyName}\n` +
          `What it does: ${input.ideaSummary}\n` +
          `Positioning: ${input.positioning}\n` +
          `Brand voice: ${input.brandVoice}\n` +
          `Location/market: ${where ?? "(not given — assume online, India-wide; don't force local festivals)"}\n` +
          `The three days to plan, in order: ${dates.join(", ")}.\n` +
          `Use exactly these dates. Today is ${dates[0]}.`,
      },
    ],
    response_format: zodResponseFormat(ContentCalendarSchema, "content_calendar"),
  });

  const calendar = completion.choices[0]?.message?.parsed;
  if (!calendar) throw new Error("Content calendar generation returned no parsed output");
  return { calendar, usage: usageFrom(completion.usage, modelFor("calendar")) };
}
