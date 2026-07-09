import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { openai, model, usageFrom, type LlmUsage } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recallMemories } from "./memory";
import { approvedContent, resumePhase, cancelRejectedTask } from "./approvals";

export const SupportDraftSchema = z.object({
  reply: z.string().describe("The reply to the customer, ready to send. Warm, direct, on-brand."),
  customerFact: z
    .string()
    .describe("One sentence worth remembering about this customer/question, or empty string"),
});
export type SupportDraft = z.infer<typeof SupportDraftSchema>;

export interface SupportPayload {
  customerMessage: string;
  customerEmail?: string;
}

/**
 * Support agent — answers inbound customer questions (forwarded from the
 * dashboard until a support inbox integration exists). Replies are reactive
 * rather than outbound marketing, so they auto-complete unless the company
 * is set to APPROVE_EVERYTHING.
 */
export async function runSupportTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: true, approval: true },
  });

  const payload = task.payload as unknown as SupportPayload;
  if (!payload?.customerMessage) throw new Error("Support task has no customerMessage in payload");

  const phase = resumePhase(task.approval);
  if (phase === "cancel") return cancelRejectedTask(taskId);
  if (phase === "execute") {
    const draft = approvedContent<SupportDraft & SupportPayload>(task.approval!);
    return sendReply(taskId, task.companyId, payload, draft);
  }

  const company = task.company;
  await assertWithinLlmCaps(company.id);
  const memories = await recallMemories(company.id, payload.customerMessage, 6);

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You are the Support agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}

Answer the customer's question directly and honestly. If you don't know
something (pricing details, timelines), say what IS true and offer to follow
up — never invent facts about the product.

Relevant memory (may contain product facts and past decisions):
${memories.map((m) => `- [${m.agent}/${m.kind}] ${m.content}`).join("\n") || "(none)"}`,
      },
      {
        role: "user",
        content: `Customer${payload.customerEmail ? ` (${payload.customerEmail})` : ""} wrote:\n\n${payload.customerMessage}\n\nDraft the reply.`,
      },
    ],
    response_format: zodResponseFormat(SupportDraftSchema, "support_reply"),
  });

  const draft = completion.choices[0]?.message?.parsed;
  if (!draft) throw new Error("Support LLM returned no valid reply");
  const usage = usageFrom(completion.usage);

  await sendReply(taskId, company.id, payload, draft, usage);
}

async function sendReply(
  taskId: string,
  companyId: string,
  payload: SupportPayload,
  draft: SupportDraft,
  usage?: LlmUsage,
): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: { companyId, provider: { in: ["RESEND", "SUPPORT_INBOX"] }, status: "CONNECTED" },
  });
  const sent = false; // real delivery lands with the email/support-inbox integration

  await logActivity({
    companyId,
    agent: "SUPPORT",
    action: integration
      ? `Replied to customer question: "${payload.customerMessage.slice(0, 80)}"`
      : `Reply ready for "${payload.customerMessage.slice(0, 80)}" — copy it from the task, or connect email to auto-send`,
    taskId,
    usage,
    detail: { reply: draft.reply, customerMessage: payload.customerMessage },
    isPublic: false, // customer conversations never hit the public feed
  });
  if (draft.customerFact?.trim()) {
    await saveMemory({
      companyId,
      agent: "SUPPORT",
      kind: "customer_fact",
      content: draft.customerFact,
      taskId,
    });
  }
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { reply: draft.reply, sent },
    },
  });
}
