import { prisma } from "@adventure/db";

export class SpendCapError extends Error {}

/**
 * Throws if the company has exhausted its daily LLM token or cost cap.
 * Call before every LLM invocation on behalf of a company.
 */
export async function assertWithinLlmCaps(companyId: string): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { llmDailyTokenCap: true, llmDailyCostCapP: true },
  });
  const today = new Date();
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const usage = await prisma.llmUsageDay.findUnique({
    where: { companyId_date: { companyId, date } },
  });
  if (!usage) return;
  const tokens = usage.inputTokens + usage.outputTokens;
  if (tokens >= company.llmDailyTokenCap) {
    throw new SpendCapError(`Daily LLM token cap reached (${tokens}/${company.llmDailyTokenCap})`);
  }
  if (usage.costP >= company.llmDailyCostCapP) {
    throw new SpendCapError(`Daily LLM cost cap reached`);
  }
}
