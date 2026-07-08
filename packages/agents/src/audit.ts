import { zodResponseFormat } from "openai/helpers/zod";
import { BusinessAuditReportSchema, type BusinessAuditReport } from "@adventure/core";
import { openai, model, usageFrom, type LlmUsage } from "./llm";

export interface BusinessAuditResult {
  report: BusinessAuditReport;
  usage: LlmUsage;
}

/** Fetch a business website and reduce it to plain text for the LLM. */
export async function fetchWebsiteText(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "AdventureAI-Audit/1.0 (+https://www.adventure-ai.in)" },
  });
  if (!res.ok) throw new Error(`Website returned ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 100) throw new Error("Could not read enough content from the website");
  return text.slice(0, 12_000);
}

/**
 * Market research + SWOT + product/service scope + growth implementation plan
 * for an existing business, grounded in its website content.
 */
export async function generateBusinessAudit(input: {
  websiteUrl: string;
  websiteText: string;
  businessName?: string;
  notes?: string;
}): Promise<BusinessAuditResult> {
  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content:
          "You are a senior marketing executive (20+ years, ex-CMO) advising an existing business. " +
          "Ground every claim in the website content provided plus well-known industry knowledge — " +
          "be specific to THIS business, never generic. Name real competitors — both local/regional " +
          "(India, and city-level if the website reveals a location) and global players — with their " +
          "actual market strengths; never invent placeholder names. The implementation plan must read like a " +
          "seasoned executive's growth mandate: prioritized, budget-conscious, focused on sales and " +
          "client acquisition, with realistic timelines for a small-to-mid Indian business.",
      },
      {
        role: "user",
        content:
          `Business website: ${input.websiteUrl}\n` +
          (input.businessName ? `Business name: ${input.businessName}\n` : "") +
          (input.notes ? `Owner's notes on products/services: ${input.notes}\n` : "") +
          `\nWebsite content (extracted text):\n${input.websiteText}`,
      },
    ],
    response_format: zodResponseFormat(BusinessAuditReportSchema, "business_audit"),
  });

  const report = completion.choices[0]?.message?.parsed;
  if (!report) throw new Error("Audit generation returned no parsed output");
  return { report, usage: usageFrom(completion.usage) };
}
