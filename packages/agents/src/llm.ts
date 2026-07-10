import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers";

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!_client) {
    const raw = new OpenAI();
    // LangSmith tracing: every agent call (prompt, output, latency, tokens)
    // shows up at smith.langchain.com when LANGSMITH_API_KEY is set. No-op
    // otherwise — the wrapper is inert without the env.
    _client = process.env.LANGSMITH_API_KEY ? (wrapOpenAI(raw) as unknown as OpenAI) : raw;
  }
  return _client;
}

/** Model for all agent reasoning — configurable via env. */
export function model(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  costPaise: number;
}

// Rough per-MTok pricing in paise (USD→INR ~84) for internal cost tracking
// only; billing never depends on this.
const PRICE_TABLE: Record<string, { inPaise: number; outPaise: number }> = {
  "gpt-4o": { inPaise: 2.5 * 84 * 100, outPaise: 10 * 84 * 100 },
  "gpt-4o-mini": { inPaise: 0.15 * 84 * 100, outPaise: 0.6 * 84 * 100 },
  "gpt-4.1": { inPaise: 2 * 84 * 100, outPaise: 8 * 84 * 100 },
  "gpt-4.1-mini": { inPaise: 0.4 * 84 * 100, outPaise: 1.6 * 84 * 100 },
};

export function usageFrom(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
} | null | undefined): LlmUsage {
  const price = PRICE_TABLE[model()] ?? PRICE_TABLE["gpt-4o"];
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const costPaise = Math.ceil(
    (inputTokens / 1_000_000) * price.inPaise +
      (outputTokens / 1_000_000) * price.outPaise,
  );
  return { inputTokens, outputTokens, costPaise };
}
