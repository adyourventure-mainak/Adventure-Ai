import { zodResponseFormat } from "openai/helpers/zod";
import { BusinessAuditReportSchema, type BusinessAuditReport } from "@adventure/core";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";

export interface BusinessAuditResult {
  report: BusinessAuditReport;
  usage: LlmUsage;
}

/**
 * Reject non-http(s) URLs and anything pointing at a private/internal target.
 * Exported so callers validate the user's input with the same rule the fetch
 * below applies to every redirect hop.
 */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host.startsWith("[") || host.includes(":")) return false; // IPv6 literal
  // IPv4 literals: block loopback, private, link-local (cloud metadata) ranges.
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 169 && b === 254) return false; // 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    return false; // no legitimate business site is a bare IP
  }
  return true;
}

/**
 * Fetch a business website and reduce it to plain text for the LLM.
 * Redirects are followed manually so each hop is re-validated — otherwise an
 * attacker-controlled site could 302 us onto an internal address and have the
 * response summarised back into their audit report (SSRF).
 */
export async function fetchWebsiteText(url: string): Promise<string> {
  let current = url;
  let res: Response | undefined;
  for (let hop = 0; hop < 5; hop++) {
    if (!isSafePublicUrl(current)) throw new Error("That URL can't be audited");
    res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "AdventureAI-Audit/1.0 (+https://www.adventure-ai.in)" },
    });
    if (res.status < 300 || res.status >= 400) break;
    const location = res.headers.get("location");
    if (!location) break;
    current = new URL(location, current).toString(); // re-validated next iteration
    res = undefined;
  }
  if (!res) throw new Error("Too many redirects");
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
    model: modelFor("audit"),
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
  return { report, usage: usageFrom(completion.usage, modelFor("audit")) };
}
