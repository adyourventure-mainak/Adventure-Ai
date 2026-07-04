import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { openai, model, usageFrom } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recentMemories } from "./memory";

const ResearchOutputSchema = z.object({
  findings: z
    .array(
      z.object({
        insight: z.string().describe("A concrete, specific finding — not a platitude"),
        soWhat: z.string().describe("What the company should do differently because of it"),
      }),
    )
    .min(3)
    .max(5),
  recommendation: z
    .string()
    .describe("The single highest-leverage move suggested by the findings, one sentence"),
});

/**
 * Research agent — reasons about the market, competitors, and positioning
 * from the company's context and memory. Findings feed the shared memory so
 * the Orchestrator, Social and Outreach agents build on them in later cycles.
 * Nothing outbound, so it always auto-completes.
 */
export async function runResearchTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: true },
  });
  const company = task.company;
  await assertWithinLlmCaps(company.id);

  const topic = (task.payload as { topic?: string })?.topic ?? task.title;
  const memories = await recentMemories(company.id, 12);

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You are the Research agent for "${company.name}".
Positioning: ${company.positioning}
Idea: ${company.ideaSummary}

Think like a sharp analyst, not a cheerleader: name real competitor dynamics,
customer objections, and channel realities for this kind of business in India.
Prefer uncomfortable specifics over safe generalities. Do not repeat what the
company already knows (see memory).

What the company already knows:
${memories.map((m) => `- [${m.agent}/${m.kind}] ${m.content}`).join("\n") || "(none)"}`,
      },
      { role: "user", content: `Research focus: ${topic}` },
    ],
    response_format: zodResponseFormat(ResearchOutputSchema, "research"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("Research LLM returned no valid output");
  const usage = usageFrom(completion.usage);

  for (const f of parsed.findings) {
    await saveMemory({
      companyId: company.id,
      agent: "RESEARCH",
      kind: "research",
      content: `${f.insight} → ${f.soWhat}`,
      taskId,
    });
  }
  await logActivity({
    companyId: company.id,
    agent: "RESEARCH",
    action: `Researched "${topic}" — ${parsed.findings.length} findings. Top move: ${parsed.recommendation.slice(0, 120)}`,
    taskId,
    usage,
    detail: { findings: parsed.findings, recommendation: parsed.recommendation },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { findings: parsed.findings, recommendation: parsed.recommendation },
    },
  });
}
