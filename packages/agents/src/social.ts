import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { openai, model, usageFrom, type LlmUsage } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recallMemories } from "./memory";
import { requestApproval, approvedContent, resumePhase, cancelRejectedTask } from "./approvals";

export const SocialDraftSchema = z.object({
  platform: z.enum(["twitter", "linkedin", "instagram"]),
  text: z.string().describe("The post body, ready to publish. Respect platform norms and length."),
  hashtags: z.array(z.string()).max(5).describe("Without the # prefix"),
});
export type SocialDraft = z.infer<typeof SocialDraftSchema>;

/**
 * Social agent — drafts posts from the orchestrator's topic (or a user
 * request). Publishing is gated by company autonomy: FULL_AUTO ships
 * immediately, otherwise the draft lands in the approvals inbox and this
 * runner is re-entered after the decision.
 */
export async function runSocialTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: true, approval: true },
  });

  const phase = resumePhase(task.approval);
  if (phase === "cancel") return cancelRejectedTask(taskId);
  if (phase === "execute") {
    const post = approvedContent<SocialDraft>(task.approval!);
    return publishPost(taskId, task.companyId, post);
  }

  const company = task.company;
  await assertWithinLlmCaps(company.id);

  const topic =
    (task.payload as { topic?: string; platform?: string })?.topic ?? task.title;
  const preferredPlatform = (task.payload as { platform?: string })?.platform;
  const memories = await recallMemories(company.id, topic, 5);

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You are the Social agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}

Write one social post that earns attention without hype. Hook in the first
line, one idea per post, end with a reason to visit the site. No emoji walls,
no engagement bait.${preferredPlatform ? ` Target platform: ${preferredPlatform}.` : ""}

Relevant memory:
${memories.map((m) => `- [${m.agent}] ${m.content}`).join("\n") || "(none)"}`,
      },
      { role: "user", content: `Draft a post about: ${topic}` },
    ],
    response_format: zodResponseFormat(SocialDraftSchema, "social_post"),
  });

  const draft = completion.choices[0]?.message?.parsed;
  if (!draft) throw new Error("Social LLM returned no valid post");
  const usage = usageFrom(completion.usage);

  if (company.autonomyLevel === "FULL_AUTO") {
    return publishPost(taskId, company.id, draft, usage);
  }
  await requestApproval({
    task,
    kind: "SOCIAL_POST",
    draft,
    summary: `${draft.platform} post — "${draft.text.slice(0, 80)}"`,
    usage,
  });
}

/**
 * Ship the post. No social integration is connected yet (Phase 4 wires
 * Buffer/Twitter/LinkedIn), so the approved post is recorded as
 * ready-to-publish and shown on the feed — same graceful degradation as
 * provisioning.
 */
async function publishPost(
  taskId: string,
  companyId: string,
  post: SocialDraft,
  usage?: LlmUsage,
): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: {
      companyId,
      provider: { in: ["BUFFER", "TWITTER", "LINKEDIN", "INSTAGRAM"] },
      status: "CONNECTED",
    },
  });
  const published = false; // real publish lands with the first connected integration

  await logActivity({
    companyId,
    agent: "SOCIAL",
    action: integration
      ? `Published to ${post.platform}: "${post.text.slice(0, 100)}"`
      : `Post approved for ${post.platform} — connect a social integration to auto-publish: "${post.text.slice(0, 100)}"`,
    taskId,
    usage,
    detail: { post },
  });
  await saveMemory({
    companyId,
    agent: "SOCIAL",
    kind: "event",
    content: `Approved ${post.platform} post: ${post.text.slice(0, 200)}`,
    taskId,
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { post, published },
    },
  });
}
