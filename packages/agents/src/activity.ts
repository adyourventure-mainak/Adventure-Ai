import { prisma } from "@adventure/db";
import type { AgentType } from "@adventure/db";
import type { LlmUsage } from "./llm";

/**
 * Append to the immutable activity log and roll usage into the daily
 * LLM usage counter (which guardrails read for cap enforcement).
 */
export async function logActivity(params: {
  companyId: string;
  agent: AgentType;
  action: string;
  detail?: Record<string, unknown>;
  taskId?: string;
  usage?: LlmUsage;
  isPublic?: boolean;
}) {
  const usage = params.usage;
  const today = new Date();
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        companyId: params.companyId,
        agent: params.agent,
        action: params.action,
        detail: (params.detail ?? {}) as object,
        taskId: params.taskId,
        isPublic: params.isPublic ?? true,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        llmCostP: usage?.costPaise ?? 0,
      },
    }),
    ...(usage
      ? [
          prisma.llmUsageDay.upsert({
            where: { companyId_date: { companyId: params.companyId, date } },
            create: {
              companyId: params.companyId,
              date,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              costP: usage.costPaise,
            },
            update: {
              inputTokens: { increment: usage.inputTokens },
              outputTokens: { increment: usage.outputTokens },
              costP: { increment: usage.costPaise },
            },
          }),
        ]
      : []),
  ]);
}
