import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma, creditBalance } from "@adventure/db";
import { openai, model, usageFrom } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory } from "./memory";

const FinanceOutputSchema = z.object({
  summary: z
    .string()
    .describe("2-4 sentence plain-language read of the numbers for the founder"),
  watchout: z.string().describe("The one number to keep an eye on, and why. One sentence."),
});

/**
 * Finance agent — compiles the company's real numbers (credit ledger, LLM
 * spend, revenue-share transfers, task throughput), writes today's
 * KpiSnapshot, and adds short commentary. The numbers come from the DB;
 * the LLM only narrates them.
 */
export async function runFinanceTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: { include: { subscription: true } } },
  });
  const company = task.company;
  await assertWithinLlmCaps(company.id);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [credits, llmMonth, transfersMonth, tasksWeek, tasksToday, emailsSent] = await Promise.all([
    creditBalance(company.id),
    prisma.llmUsageDay.aggregate({
      where: { companyId: company.id, date: { gte: monthStart } },
      _sum: { costP: true, inputTokens: true, outputTokens: true },
    }),
    prisma.transferRecord.aggregate({
      where: { companyId: company.id, createdAt: { gte: monthStart }, status: "processed" },
      _sum: { grossAmountP: true, settledAmountP: true, platformFeeP: true },
    }),
    prisma.task.count({
      where: { companyId: company.id, status: "COMPLETED", completedAt: { gte: weekAgo } },
    }),
    prisma.task.count({
      where: { companyId: company.id, status: "COMPLETED", completedAt: { gte: today } },
    }),
    prisma.activityLog.count({
      where: { companyId: company.id, agent: "EMAIL_OUTREACH", createdAt: { gte: today } },
    }),
  ]);

  const numbers = {
    creditBalance: credits,
    llmSpendMonthPaise: llmMonth._sum.costP ?? 0,
    llmTokensMonth: (llmMonth._sum.inputTokens ?? 0) + (llmMonth._sum.outputTokens ?? 0),
    revenueGrossMonthPaise: transfersMonth._sum.grossAmountP ?? 0,
    revenueSettledMonthPaise: transfersMonth._sum.settledAmountP ?? 0,
    platformFeeMonthPaise: transfersMonth._sum.platformFeeP ?? 0,
    tasksCompletedLast7d: tasksWeek,
    subscription: company.subscription?.status ?? "NONE",
    adBudgetCapPaise: company.adBudgetCapP,
  };

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You are the Finance agent for "${company.name}". You narrate real
numbers for a non-finance founder: plain language, amounts in rupees (divide
paise by 100), no jargon, no invented figures. If revenue is zero, say so
plainly and point at what unblocks it.`,
      },
      { role: "user", content: `This month's numbers (paise unless noted):\n${JSON.stringify(numbers, null, 2)}` },
    ],
    response_format: zodResponseFormat(FinanceOutputSchema, "finance_report"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("Finance LLM returned no valid report");
  const usage = usageFrom(completion.usage);

  await prisma.kpiSnapshot.upsert({
    where: { companyId_date: { companyId: company.id, date: today } },
    create: {
      companyId: company.id,
      date: today,
      revenueP: numbers.revenueGrossMonthPaise,
      emailsSent,
      tasksCompleted: tasksToday,
    },
    update: {
      revenueP: numbers.revenueGrossMonthPaise,
      emailsSent,
      tasksCompleted: tasksToday,
    },
  });

  await logActivity({
    companyId: company.id,
    agent: "FINANCE",
    action: `Finance check: ${parsed.summary.slice(0, 160)}`,
    taskId,
    usage,
    detail: { numbers, summary: parsed.summary, watchout: parsed.watchout },
    isPublic: false, // company financials stay off the public feed
  });
  await saveMemory({
    companyId: company.id,
    agent: "FINANCE",
    kind: "learning",
    content: `Finance watchout: ${parsed.watchout}`,
    taskId,
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { numbers, summary: parsed.summary, watchout: parsed.watchout },
    },
  });
}
