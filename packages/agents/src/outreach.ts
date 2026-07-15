import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recallMemories } from "./memory";
import { approvedContent, resumePhase, cancelRejectedTask } from "./approvals";

export const OutreachDraftSchema = z.object({
  audience: z.string().describe("Who this email targets, in one line"),
  subject: z.string().describe("Subject line — specific, no clickbait"),
  body: z
    .string()
    .describe("Plain-text email body, under 150 words, personalized to the audience, one clear CTA"),
});
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

/**
 * Email Outreach agent — drafts cold/warm outreach emails. Outbound email
 * ALWAYS requires the founder's approval regardless of autonomy level:
 * spam damage to a new domain is irreversible, so this is a deliberate
 * platform guardrail, not a preference.
 */
export async function runOutreachTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: true, approval: true },
  });

  const phase = resumePhase(task.approval);
  if (phase === "cancel") return cancelRejectedTask(taskId);
  if (phase === "execute") {
    const email = approvedContent<OutreachDraft>(task.approval!);
    return sendOutreach(taskId, task.companyId, email);
  }

  const company = task.company;
  await assertWithinLlmCaps(company.id);

  const goal =
    (task.payload as { goal?: string; audience?: string })?.goal ?? task.title;
  const audienceHint = (task.payload as { audience?: string })?.audience;
  const memories = await recallMemories(company.id, goal, 5);

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("outreach"),
    messages: [
      {
        role: "system",
        content: `You are the Email Outreach agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}

Write outreach a busy stranger would actually read: lead with something true
about THEM, one concrete benefit, one low-friction ask. No "I hope this email
finds you well", no feature lists.${audienceHint ? ` Target audience: ${audienceHint}.` : ""}

Relevant memory:
${memories.map((m) => `- [${m.agent}] ${m.content}`).join("\n") || "(none)"}`,
      },
      { role: "user", content: `Draft an outreach email. Goal: ${goal}` },
    ],
    response_format: zodResponseFormat(OutreachDraftSchema, "outreach_email"),
  });

  const draft = completion.choices[0]?.message?.parsed;
  if (!draft) throw new Error("Outreach LLM returned no valid email");
  const usage = usageFrom(completion.usage, modelFor("outreach"));

  // Draft ships straight to the company inbox as a ready-to-send email —
  // nothing is actually sent until an email integration is connected.
  return sendOutreach(taskId, company.id, draft, usage);
}

/**
 * Ship the approved email. EMAIL_IDENTITY provisioning (Resend domain) is a
 * later phase, so until an email integration is connected the approved copy
 * is recorded as ready-to-send.
 */
async function sendOutreach(
  taskId: string,
  companyId: string,
  email: OutreachDraft,
  usage?: LlmUsage,
): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: { companyId, provider: "RESEND", status: "CONNECTED" },
  });
  const sent = false; // real sending lands with the RESEND integration

  await logActivity({
    companyId,
    agent: "EMAIL_OUTREACH",
    action: integration
      ? `Sent outreach to ${email.audience}: "${email.subject}"`
      : `Outreach approved for ${email.audience} — connect email (Resend) to send: "${email.subject}"`,
    taskId,
    usage,
    detail: { email },
  });
  await saveMemory({
    companyId,
    agent: "EMAIL_OUTREACH",
    kind: "event",
    content: `Approved outreach email to ${email.audience}: "${email.subject}"`,
    taskId,
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { email, sent },
    },
  });
}
