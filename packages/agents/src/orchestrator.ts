import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma, Prisma } from "@adventure/db";
import { openai, modelFor, usageFrom } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recentMemories } from "./memory";

const CycleOutputSchema = z.object({
  brief: z
    .string()
    .describe("Daily brief for the founder, in markdown: what happened, today's focus, what's next. 150-300 words."),
  engineerTasks: z
    .array(
      z.object({
        title: z.string().describe("Short imperative task title"),
        instruction: z.string().describe("Concrete instruction the Engineer can execute on the landing page"),
      }),
    )
    .max(2)
    .describe("0-2 landing-page improvements for today. Empty if the page is in good shape."),
  socialTasks: z
    .array(
      z.object({
        title: z.string().describe("Short imperative task title"),
        topic: z.string().describe("What the post should be about — angle, not final copy"),
        platform: z.enum(["twitter", "linkedin", "instagram"]),
      }),
    )
    .max(2)
    .describe("0-2 social posts for today. Vary angles across days; don't post for the sake of it."),
  outreachTasks: z
    .array(
      z.object({
        title: z.string().describe("Short imperative task title"),
        audience: z.string().describe("Who to reach, in one line"),
        goal: z.string().describe("What the email should achieve"),
      }),
    )
    .max(1)
    .describe("0-1 outreach email for today. Drafts always go to the founder for approval."),
  researchTasks: z
    .array(
      z.object({
        title: z.string().describe("Short imperative task title"),
        topic: z.string().describe("A specific question worth answering — not 'research the market'"),
      }),
    )
    .max(1)
    .describe("0-1 research question for today. Only when a real unknown is blocking progress."),
  adsTasks: z
    .array(
      z.object({
        title: z.string().describe("Short imperative task title"),
        objective: z.string().describe("What the campaign should achieve and for whom"),
      }),
    )
    .max(1)
    .describe("0-1 ad campaign proposal. ONLY if ads are enabled (budget cap > 0)."),
  runFinanceCheck: z
    .boolean()
    .describe("true to run the Finance agent today (weekly is plenty unless money moved)"),
  memoryNote: z.string().describe("One sentence worth remembering tomorrow"),
});

/**
 * Orchestrator/CEO agent — one planning cycle: read company state + memory,
 * write the daily brief, and dispatch Engineer tasks. (More agents join the
 * dispatch roster in Phases 3-4.)
 */
export async function runDailyCycle(companyId: string): Promise<{ dispatched: string[] }> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      plan: true,
      landingPage: true,
      agentStates: true,
      tasks: { orderBy: { createdAt: "desc" }, take: 10 },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (company.status !== "ACTIVE") {
    return { dispatched: [] };
  }
  const orchestratorState = company.agentStates.find((a) => a.agent === "ORCHESTRATOR");
  if (orchestratorState && !orchestratorState.enabled) return { dispatched: [] };

  await assertWithinLlmCaps(companyId);
  const memories = await recentMemories(companyId, 10);
  const today = new Date().toISOString().slice(0, 10);

  const existingBrief = await prisma.dailyBrief.findUnique({
    where: { companyId_date: { companyId, date: new Date(today) } },
  });
  if (existingBrief) return { dispatched: [] }; // one cycle per day is idempotent

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("orchestrator"),
    messages: [
      {
        role: "system",
        content: `You are the CEO agent running "${company.name}" for its founder.
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}
30-day plan: ${JSON.stringify(company.plan?.thirtyDayPlan ?? [])}

Your team today:
- Engineer: modifies the landing page from natural-language instructions.
- Social: drafts posts (twitter/linkedin/instagram); drafts may need founder approval.
- Email Outreach: drafts cold/warm emails; ALWAYS founder-approved before sending.
- Research: answers one specific market/competitor question; findings land in shared memory.
- Ads: proposes ONE campaign; every budget is founder-approved. Ads budget cap: ${company.adBudgetCapP > 0 ? `₹${Math.floor(company.adBudgetCapP / 100)}/month` : "₹0 — ads are OFF, do not dispatch ads tasks"}.
- Finance: compiles real numbers (spend, revenue share, throughput) — run weekly or when money moved.
- Support: answers inbound customer questions reactively — don't dispatch it.

Dispatch only what moves the needle today; an empty task list is a valid plan.

Write like a sharp operator: concrete, honest about what's done vs pending,
no fluff.`,
      },
      {
        role: "user",
        content: `Today is ${today}. Run the daily planning cycle.

Recent activity:
${company.activityLogs.map((l) => `- [${l.agent}] ${l.action}`).join("\n") || "(none)"}

Recent tasks:
${company.tasks.map((t) => `- [${t.status}] ${t.title}`).join("\n") || "(none)"}

Memory:
${memories.map((m) => `- [${m.agent}/${m.kind}] ${m.content}`).join("\n") || "(none)"}

Current landing copy:
${JSON.stringify(company.landingPage?.copy ?? {})}`,
      },
    ],
    response_format: zodResponseFormat(CycleOutputSchema, "daily_cycle"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("Orchestrator LLM returned no valid cycle output");
  const usage = usageFrom(completion.usage, modelFor("orchestrator"));

  await prisma.dailyBrief.create({
    data: { companyId, date: new Date(today), content: parsed.brief },
  });

  type DispatchableAgent = "ENGINEER" | "SOCIAL" | "EMAIL_OUTREACH" | "RESEARCH" | "ADS" | "FINANCE";
  const enabled = (agent: DispatchableAgent) =>
    company.agentStates.find((a) => a.agent === agent)?.enabled ?? true;

  const dispatched: string[] = [];
  const titles: string[] = [];
  const roster: Array<{
    agent: DispatchableAgent;
    type: string;
    items: Array<{ title: string; payload: Prisma.InputJsonObject }>;
  }> = [
    {
      agent: "ENGINEER",
      type: "landing_page_edit",
      items: parsed.engineerTasks.map((t) => ({ title: t.title, payload: { instruction: t.instruction } })),
    },
    {
      agent: "SOCIAL",
      type: "social_post",
      items: parsed.socialTasks.map((t) => ({ title: t.title, payload: { topic: t.topic, platform: t.platform } })),
    },
    {
      agent: "EMAIL_OUTREACH",
      type: "cold_email",
      items: parsed.outreachTasks.map((t) => ({ title: t.title, payload: { audience: t.audience, goal: t.goal } })),
    },
    {
      agent: "RESEARCH",
      type: "research",
      items: parsed.researchTasks.map((t) => ({ title: t.title, payload: { topic: t.topic } })),
    },
    {
      agent: "ADS",
      // Belt-and-braces: the Ads runner also refuses when the cap is 0.
      type: "ad_campaign",
      items:
        company.adBudgetCapP > 0
          ? parsed.adsTasks.map((t) => ({ title: t.title, payload: { objective: t.objective } }))
          : [],
    },
    {
      agent: "FINANCE",
      type: "finance_report",
      items: parsed.runFinanceCheck ? [{ title: "Weekly finance check", payload: {} }] : [],
    },
  ];
  for (const { agent, type, items } of roster) {
    if (!enabled(agent) || items.length === 0) continue;
    for (const item of items) {
      const task = await prisma.task.create({
        data: {
          companyId,
          agent,
          type,
          title: item.title,
          source: "AGENT",
          status: "PENDING",
          payload: item.payload,
        },
      });
      dispatched.push(task.id);
      titles.push(`${agent}: ${item.title}`);
    }
  }

  await logActivity({
    companyId,
    agent: "ORCHESTRATOR",
    action:
      dispatched.length > 0
        ? `Wrote today's brief and dispatched ${dispatched.length} task(s) across the team`
        : "Wrote today's brief — no changes needed today",
    detail: { taskTitles: titles },
    usage,
  });
  await saveMemory({
    companyId,
    agent: "ORCHESTRATOR",
    kind: "learning",
    content: `${today}: ${parsed.memoryNote}`,
  });

  return { dispatched };
}
