import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { LandingCopySchema, type CompanyTheme, type LandingCopy } from "@adventure/core";
import { openai, model, usageFrom } from "./llm";
import { logActivity } from "./activity";
import { assertWithinLlmCaps } from "./guardrails";
import { saveMemory, recallMemories } from "./memory";
import * as github from "./github";
import { renderSite } from "./site";

const EditResultSchema = z.object({
  updatedCopy: LandingCopySchema,
  // Visual/brand changes. Return null for anything the request doesn't ask to change.
  accentColor: z.string().nullable().describe("New accent colour as #rrggbb hex, or null to keep the current one"),
  accentDarkColor: z.string().nullable().describe("Darker hover shade of the accent as #rrggbb hex, or null"),
  style: z.enum(["minimal", "bold", "playful", "elegant", "corporate"]).nullable().describe("New visual style, or null"),
  fontFamily: z.enum(["sans", "serif", "rounded", "mono"]).nullable().describe("New font family, or null"),
  removeUploadedImages: z.boolean().nullable().describe("true ONLY if the owner asked to remove/delete their uploaded image(s) from the website"),
  facebookUrl: z.string().nullable().describe("Full Facebook page URL if the owner asked to link one, else null"),
  instagramUrl: z.string().nullable().describe("Full Instagram profile URL if the owner asked to link one, else null"),
  changeSummary: z.string().describe("One sentence describing what changed and why"),
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const asUrl = (u: string | null) =>
  u && /^https?:\/\//.test(u) ? u : u ? `https://${u.replace(/^\/+/, "")}` : null;

/**
 * Engineer agent — Phase 2 capability: landing-page changes from natural
 * language. Updates the copy JSON, bumps the version, and (when the company
 * has a provisioned repo) commits the re-rendered site so Vercel redeploys.
 */
export async function runEngineerTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { company: { include: { landingPage: true, provisions: true } } },
  });
  const company = task.company;
  const landing = company.landingPage;
  if (!landing) throw new Error("Company has no landing page to edit");

  await assertWithinLlmCaps(company.id);

  const payload = task.payload as { instruction?: string; imageUrls?: string[] } | null;
  const instruction = payload?.instruction ?? task.title;
  const memories = await recallMemories(company.id, instruction, 5);

  // Merge freshly uploaded images into the company's design brief so every
  // future rebuild keeps them. The brief lives on Company.theme.
  let theme = (company.theme ?? {}) as CompanyTheme;
  const newImages = (payload?.imageUrls ?? []).filter((u) => /^https:\/\//.test(u));
  if (newImages.length > 0) {
    const merged = [...new Set([...(theme.imageUrls ?? []), ...newImages])].slice(-5);
    theme = { ...theme, imageUrls: merged };
    await prisma.company.update({ where: { id: company.id }, data: { theme } });
  }
  const designBrief = [
    ...(theme.suggestions ?? []).map((sg, i) => `${i + 1}. ${sg}`),
  ].join("\n");

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You are the Engineer agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}

You are an expert web designer and maintain the company's website. Given the
current copy JSON and a change request, return the full updated copy. Keep
everything not mentioned in the request unchanged. Stay on-brand and
benefit-led; no filler.

You can also change the site's visual theme: accentColor/accentDarkColor
(hex), style, and fontFamily — set them ONLY when the request asks for
colours, look or feel (pick tasteful hex values that fit; the site is a clean
template with one accent colour). If the owner asks to link their Facebook or
Instagram page, set facebookUrl/instagramUrl. The site already supports: a
call button (when the company has a phone number), a WhatsApp chat button,
owner-uploaded hero/gallery images (set removeUploadedImages to true to take
them off the site when asked), and social links in the footer.
${designBrief ? `\nThe owner's design preferences (always respect these):\n${designBrief}\n` : ""}${theme.imageUrls?.length ? `The owner has uploaded ${theme.imageUrls.length} image(s) that are shown on the site (hero + gallery).\n` : ""}
Relevant memory:
${memories.map((m) => `- [${m.agent}] ${m.content}`).join("\n") || "(none)"}`,
      },
      {
        role: "user",
        content: `Current landing copy JSON:\n${JSON.stringify(landing.copy, null, 2)}\n\nChange request:\n${instruction}`,
      },
    ],
    response_format: zodResponseFormat(EditResultSchema, "landing_edit"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("Engineer LLM returned no valid edit");
  const usage = usageFrom(completion.usage);

  // Apply requested visual/brand changes to the persistent theme + socials.
  const themePatch: Partial<CompanyTheme> = {};
  if (parsed.removeUploadedImages) themePatch.imageUrls = [];
  if (parsed.accentColor && HEX.test(parsed.accentColor)) themePatch.accentColor = parsed.accentColor;
  if (parsed.accentDarkColor && HEX.test(parsed.accentDarkColor)) themePatch.accentDarkColor = parsed.accentDarkColor;
  if (parsed.style) themePatch.style = parsed.style;
  if (parsed.fontFamily) themePatch.fontFamily = parsed.fontFamily;
  const facebookUrl = asUrl(parsed.facebookUrl);
  const instagramUrl = asUrl(parsed.instagramUrl);
  if (Object.keys(themePatch).length > 0 || facebookUrl || instagramUrl || parsed.removeUploadedImages) {
    theme = { ...theme, ...themePatch };
    await prisma.company.update({
      where: { id: company.id },
      data: {
        theme,
        ...(facebookUrl ? { facebookUrl } : {}),
        ...(instagramUrl ? { instagramUrl } : {}),
      },
    });
  }

  await prisma.landingPage.update({
    where: { companyId: company.id },
    data: { copy: parsed.updatedCopy, version: { increment: 1 } },
  });

  // Ship it if the repo exists; otherwise the preview is the deliverable.
  const repo = company.provisions.find((p) => p.resource === "GITHUB_REPO" && p.status === "DONE");
  let deployed = false;
  if (repo?.externalId && github.githubConfigured()) {
    for (const page of renderSite({
      companyId: company.id,
      companyName: company.name,
      ideaSummary: company.ideaSummary,
      positioning: company.positioning,
      phone: company.phone,
      facebookUrl: facebookUrl ?? company.facebookUrl,
      instagramUrl: instagramUrl ?? company.instagramUrl,
      youtubeUrl: company.youtubeUrl,
      linkedinUrl: company.linkedinUrl,
      theme,
      copy: parsed.updatedCopy as LandingCopy,
    })) {
      await github.putFile({
        repoFullName: repo.externalId,
        path: page.path,
        content: page.content,
        message: `feat: ${parsed.changeSummary.slice(0, 60)} (${page.path})`,
      });
    }
    deployed = true;
  }

  await logActivity({
    companyId: company.id,
    agent: "ENGINEER",
    action: deployed
      ? `Updated the landing page and pushed to ${repo!.externalId} — deploying: ${parsed.changeSummary}`
      : `Updated the landing page preview: ${parsed.changeSummary}`,
    taskId,
    usage,
  });
  await saveMemory({
    companyId: company.id,
    agent: "ENGINEER",
    kind: "decision",
    content: `Landing page change: ${parsed.changeSummary} (requested: "${instruction.slice(0, 200)}")`,
    taskId,
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: { changeSummary: parsed.changeSummary, deployed },
    },
  });
}
