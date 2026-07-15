import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma, creditBalance } from "@adventure/db";
import { openai, modelFor, usageFrom } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory } from "./memory";

const FinanceOutputSchema = z.object({
  summary: z
    .string()
    .describe("2-4 sentence plain-language read of the ACTUAL numbers for the founder"),
  watchout: z.string().describe("The one number to keep an eye on, and why. One sentence."),
  // Forward-looking and clearly separate from the actuals above. This is a
  // proposal the founder decides on — it never moves money or enables ads.
  proposal: z.object({
    platform: z
      .enum(["meta", "google_search", "instagram", "whatsapp", "linkedin", "none"])
      .describe("The single best channel to start on for THIS business and market"),
    platformReason: z.string().describe("Why this channel beats the others here. One or two sentences."),
    monthlyAdBudgetRupees: z
      .number()
      .int()
      .describe("Recommended monthly ad spend in whole rupees. Start small and provable; 0 if ads are not sensible yet"),
    assumptions: z
      .object({
        costPerClickRupees: z.number().describe("Typical CPC for this category/market, in rupees"),
        clicksPerMonth: z.number().int().describe("budget ÷ CPC"),
        conversionRatePercent: z.number().describe("Realistic click→paying-customer rate, in percent"),
        averageOrderValueRupees: z.number().int().describe("Typical order/deal value in rupees"),
      })
      .describe("The workings behind the projection. Must be internally consistent with the numbers above."),
    expectedMonthlyRevenueLowRupees: z.number().int().describe("Conservative end of the projection"),
    expectedMonthlyRevenueHighRupees: z.number().int().describe("Optimistic end of the projection"),
    confidence: z
      .enum(["low", "medium", "high"])
      .describe("How much to trust this before real spend data exists. Be honest — usually low at the start."),
    rationale: z.string().describe("2-3 sentences: why this budget, and what would prove or kill it fastest."),
  }),
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
    include: { company: { include: { subscription: true, landingPage: true } } },
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

  // Real ad spend to date — grounds the proposal and tells the model whether
  // its previous guesses have been tested yet.
  const adSpendMonth = await prisma.kpiSnapshot.aggregate({
    where: { companyId: company.id, date: { gte: monthStart } },
    _sum: { adSpendP: true },
  });
  const actualAdSpendMonthPaise = adSpendMonth._sum.adSpendP ?? 0;

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("finance"),
    messages: [
      {
        role: "system",
        content: `You are the Finance agent for "${company.name}". You narrate real
numbers for a non-finance founder: plain language, amounts in rupees (divide
paise by 100), no jargon, no invented figures. If revenue is zero, say so
plainly and point at what unblocks it.

'summary' and 'watchout' describe ONLY the actual numbers given. Never mix a
forecast into them — no projected or hoped-for figures there, ever.

'proposal' is separate and forward-looking: a starting ad budget, the one
channel to start on, and what revenue that could realistically produce.
Rules for it:
- Reason from what you know about THIS business's category and market: real
  CPC ranges, realistic conversion rates, and a plausible order value there.
  Indian small-business reality, not US SaaS benchmarks.
- Show consistent workings: clicksPerMonth ≈ budget ÷ CPC, and the revenue
  range must follow from clicks × conversion × order value. A founder will
  check your arithmetic.
- Start small and provable. Prefer a budget that buys enough clicks to learn
  something (a few hundred) over a big number that sounds impressive.
- Pick ONE channel to start. Justify it against the alternatives for this
  business — not a generic "run Meta ads".
- Be honest about confidence. With no real ad spend yet this is an educated
  estimate, so say 'low' and frame the range wide. Never imply it is a promise.
- A missing ad budget cap is NOT a reason to decline. The founder has not set
  one precisely because they want your recommendation — proposing the number
  they should set is the job. Only when a cap IS set must you stay within it.
- Reserve platform 'none' for the genuine case where there is nothing to send
  traffic to (no live website) or nothing to sell yet. If a website is live
  and the business has an offer, propose a real starting budget.`,
      },
      {
        role: "user",
        content:
          `ACTUAL numbers this month (paise unless noted):\n${JSON.stringify(numbers, null, 2)}\n\n` +
          `Actual ad spend this month (paise): ${actualAdSpendMonthPaise}\n\n` +
          `Business context for the proposal:\n` +
          `- What it does: ${company.ideaSummary ?? "(not set)"}\n` +
          `- Positioning: ${company.positioning ?? "(not set)"}\n` +
          `- Market/location: ${company.location ?? "(not given — assume online, India-wide)"}\n` +
          `- Website: ${company.landingPage?.deployedUrl ? `live at ${company.landingPage.deployedUrl} (there IS somewhere to send traffic)` : "not deployed yet — nowhere to send paid traffic"}\n` +
          `- Company status: ${company.status}\n` +
          `- Ad budget cap: ${
            company.adBudgetCapP > 0
              ? `₹${Math.round(company.adBudgetCapP / 100)}/month — a hard cap; never propose more than this`
              : "none set yet, so ads are currently off. Recommend the budget the founder should set."
          }`,
      },
    ],
    response_format: zodResponseFormat(FinanceOutputSchema, "finance_report"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("Finance LLM returned no valid report");
  const usage = usageFrom(completion.usage, modelFor("finance"));

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
    detail: {
      numbers,
      actualAdSpendMonthPaise,
      summary: parsed.summary,
      watchout: parsed.watchout,
      proposal: parsed.proposal, // forecast — never merged into `numbers`
    },
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
      result: {
        numbers,
        actualAdSpendMonthPaise,
        summary: parsed.summary,
        watchout: parsed.watchout,
        proposal: parsed.proposal,
      },
    },
  });
}
