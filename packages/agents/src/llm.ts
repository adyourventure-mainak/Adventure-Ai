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

/** Default model for agent reasoning (the "mid" tier) — configurable via env. */
export function model(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}

/**
 * Every agent that reasons. Work is tiered by what it actually needs:
 *   frontier — output quality IS the product; a whole company (or a paid
 *              deliverable) is generated from it.
 *   mid      — customer-facing but bounded, short outputs.
 *   mini     — mechanical extraction/narration, no judgement required.
 *              `reviews` feeds ~60k chars of Google HTML in to pull 3 quotes;
 *              `finance` only narrates numbers already computed from the DB.
 */
export type AgentModel =
  | "onboarding"
  | "audit"
  | "adplan"
  | "engineer"
  | "orchestrator"
  | "support"
  | "outreach"
  | "social"
  | "research"
  | "ads"
  | "finance"
  | "reviews";

type Tier = "frontier" | "mid" | "mini";

const TIER: Record<AgentModel, Tier> = {
  onboarding: "frontier",
  audit: "frontier",
  adplan: "frontier",
  engineer: "mid",
  orchestrator: "mid",
  support: "mid",
  outreach: "mid",
  social: "mid",
  research: "mid",
  ads: "mid",
  finance: "mini",
  reviews: "mini",
};

function tierModel(tier: Tier): string {
  if (tier === "frontier") return process.env.OPENAI_MODEL_FRONTIER || model();
  if (tier === "mini") return process.env.OPENAI_MODEL_MINI || "gpt-4o-mini";
  return model();
}

/**
 * Resolve the model for one agent. Precedence, most specific first:
 *   OPENAI_MODEL_SUPPORT=…  (per agent)
 *   OPENAI_MODEL_FRONTIER / OPENAI_MODEL_MINI  (per tier)
 *   OPENAI_MODEL  (global default)
 * So a model swap is an env change, never a code change.
 *
 * Note: every agent uses Structured Outputs (zodResponseFormat + .parse), so
 * any override must be a model that supports json_schema response formats.
 */
export function modelFor(agent: AgentModel): string {
  return process.env[`OPENAI_MODEL_${agent.toUpperCase()}`] || tierModel(TIER[agent]);
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

// An unpriced model falls back to gpt-4o rates, which over-states spend for
// cheap models and can trip llmDailyCostCapP early — so say so loudly once.
const warnedModels = new Set<string>();
function priceFor(modelUsed: string) {
  const price = PRICE_TABLE[modelUsed];
  if (price) return price;
  if (!warnedModels.has(modelUsed)) {
    warnedModels.add(modelUsed);
    console.warn(
      `[llm] no PRICE_TABLE entry for "${modelUsed}" — costing it at gpt-4o rates. Add it so spend caps meter correctly.`,
    );
  }
  return PRICE_TABLE["gpt-4o"];
}

/**
 * Cost for one call. `modelUsed` must be the model that served THIS request —
 * with per-agent models a global lookup would misprice every call and quietly
 * corrupt the daily spend cap.
 */
export function usageFrom(
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
  modelUsed: string = model(),
): LlmUsage {
  const price = priceFor(modelUsed);
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const costPaise = Math.ceil(
    (inputTokens / 1_000_000) * price.inPaise +
      (outputTokens / 1_000_000) * price.outPaise,
  );
  return { inputTokens, outputTokens, costPaise };
}
