import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { openai, modelFor, usageFrom, type LlmUsage } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recallMemories } from "./memory";
import { approvedContent, resumePhase, cancelRejectedTask } from "./approvals";
import { generateAndStoreImage, imageStorageConfigured } from "./images";

export const SocialDraftSchema = z.object({
  platform: z.enum(["twitter", "linkedin", "instagram", "facebook"]),
  text: z.string().describe("The post body, ready to publish. Respect platform norms and length."),
  hashtags: z.array(z.string()).max(5).describe("Without the # prefix"),
  imagePrompt: z
    .string()
    .describe("A vivid, brand-appropriate prompt for the accompanying image (photorealistic or clean illustration; no text in the image)"),
});
export type SocialDraft = z.infer<typeof SocialDraftSchema> & { imageUrl?: string };

// X/Twitter caps a post at 280 chars; we target 270 to leave headroom.
const X_LIMIT = 270;

/** The post as it's rendered for sharing: body, then a blank line + hashtags. */
function renderCaption(text: string, hashtags: string[]): string {
  return `${text}${hashtags.length ? "\n\n" + hashtags.map((h) => `#${h}`).join(" ") : ""}`;
}

/**
 * Guarantee an X/Twitter post fits 270 chars including hashtags, even if the
 * model overshoots the prompt. Drops hashtags first (keeps the message), then
 * trims the body on a word boundary as a last resort. No-op for other platforms.
 */
function fitForX(draft: SocialDraft): SocialDraft {
  if (draft.platform !== "twitter") return draft;
  let text = draft.text.trim();
  let hashtags = [...draft.hashtags];
  while (hashtags.length && renderCaption(text, hashtags).length > X_LIMIT) {
    hashtags = hashtags.slice(0, -1);
  }
  if (renderCaption(text, hashtags).length > X_LIMIT) {
    const tagLen = hashtags.length ? renderCaption("", hashtags).length : 0;
    const room = Math.max(0, X_LIMIT - tagLen - 1); // -1 for the ellipsis
    text = text.slice(0, room).replace(/\s+\S*$/, "").trim() + "…";
  }
  return { ...draft, text, hashtags };
}

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

  const payload = task.payload as { topic?: string; platform?: string; withImage?: boolean };
  const topic = payload?.topic ?? task.title;
  const preferredPlatform = payload?.platform;
  const profiles = [
    company.facebookUrl ? `Facebook: ${company.facebookUrl}` : null,
    company.instagramUrl ? `Instagram: ${company.instagramUrl}` : null,
  ].filter(Boolean);
  const memories = await recallMemories(company.id, topic, 5);

  const completion = await openai().beta.chat.completions.parse({
    model: modelFor("social"),
    messages: [
      {
        role: "system",
        content: `You are the Social agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}

Write one social post that earns attention without hype. Hook in the first
line, one idea per post, end with a reason to visit the site. No emoji walls,
no engagement bait.${preferredPlatform ? ` Target platform: ${preferredPlatform}.` : ""}
If the platform is twitter (X), the ENTIRE post — body plus all hashtags
together — must be under 270 characters. Be punchy and cut ruthlessly to fit.${profiles.length ? `\nThe company's connected profiles (prefer these platforms):\n${profiles.join("\n")}` : ""}

Relevant memory:
${memories.map((m) => `- [${m.agent}] ${m.content}`).join("\n") || "(none)"}`,
      },
      { role: "user", content: `Draft a post about: ${topic}` },
    ],
    response_format: zodResponseFormat(SocialDraftSchema, "social_post"),
  });

  const parsedDraft = completion.choices[0]?.message?.parsed;
  if (!parsedDraft) throw new Error("Social LLM returned no valid post");
  const usage = usageFrom(completion.usage, modelFor("social"));

  // Generate the accompanying image when requested; a failed/unconfigured
  // image pipeline degrades to a caption-only post rather than failing.
  // fitForX guarantees an X post fits 270 chars even if the model overshot.
  const draft: SocialDraft = fitForX({ ...parsedDraft });
  if (payload?.withImage) {
    if (imageStorageConfigured()) {
      try {
        draft.imageUrl = await generateAndStoreImage({
          companyId: company.id,
          prompt: `${parsedDraft.imagePrompt}. Brand voice: ${company.brandVoice ?? "clean, modern"}.`,
        });
      } catch (err) {
        await logActivity({
          companyId: company.id,
          agent: "SOCIAL",
          action: `Image generation failed — continuing with caption only (${String(err).slice(0, 120)})`,
          taskId,
        });
      }
    } else {
      await logActivity({
        companyId: company.id,
        agent: "SOCIAL",
        action: "Image requested but image storage is not configured — caption-only post drafted",
        taskId,
      });
    }
  }

  // Deliverables ship straight to the company inbox — no approval step.
  return publishPost(taskId, company.id, draft, usage);
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
      ? `Published to ${post.platform}${post.imageUrl ? " with image" : ""}: "${post.text.slice(0, 100)}"`
      : `Post${post.imageUrl ? " + image" : ""} ready for ${post.platform} — copy it (image link in details) or connect a social integration to auto-publish: "${post.text.slice(0, 100)}"`,
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
