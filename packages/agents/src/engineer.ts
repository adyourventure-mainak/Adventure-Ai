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
  changeSummary: z.string().describe("One sentence describing what changed and why"),
});

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

  const instruction =
    (task.payload as { instruction?: string })?.instruction ?? task.title;
  const memories = await recallMemories(company.id, instruction, 5);

  const completion = await openai().beta.chat.completions.parse({
    model: model(),
    messages: [
      {
        role: "system",
        content: `You are the Engineer agent for "${company.name}".
Positioning: ${company.positioning}
Brand voice: ${company.brandVoice}

You maintain the company's landing page. Given the current copy JSON and a
change request, return the full updated copy. Keep everything not mentioned in
the request unchanged. Stay on-brand and benefit-led; no filler.

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
      theme: company.theme as CompanyTheme | null,
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
