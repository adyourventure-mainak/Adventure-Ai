import { prisma } from "@adventure/db";
import type { LandingCopy } from "@adventure/core";
import { logActivity } from "./activity";
import { saveMemory } from "./memory";
import * as github from "./github";
import * as vercel from "./vercel";
import { renderLandingHtml } from "./site";

type Resource = "GITHUB_REPO" | "VERCEL_PROJECT" | "DB_SCHEMA" | "EMAIL_IDENTITY" | "RAZORPAY_LINKED_ACCOUNT";

async function record(
  companyId: string,
  resource: Resource,
  result: { status: "DONE" | "FAILED" | "PENDING"; externalId?: string; error?: string; meta?: object },
) {
  await prisma.provisionRecord.upsert({
    where: { companyId_resource: { companyId, resource } },
    create: { companyId, resource, ...result, meta: result.meta ?? {} },
    update: { ...result, meta: result.meta ?? {} },
  });
}

/**
 * Provision a company after its first successful subscription charge.
 * Resumable: each resource has its own ProvisionRecord; already-DONE resources
 * are skipped. Missing platform credentials mark a resource FAILED with a
 * reason instead of blocking activation — agents run either way, and the
 * Engineer degrades to preview-only edits until the repo exists.
 */
export async function provisionCompany(companyId: string): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { landingPage: true, provisions: true },
  });
  const done = new Set(company.provisions.filter((p) => p.status === "DONE").map((p) => p.resource));
  const copy = company.landingPage?.copy as LandingCopy | undefined;

  // 1. GitHub repo with the initial landing page
  let repoFullName = company.provisions.find(
    (p) => p.resource === "GITHUB_REPO" && p.status === "DONE",
  )?.externalId ?? null;

  if (!done.has("GITHUB_REPO")) {
    if (!github.githubConfigured()) {
      await record(companyId, "GITHUB_REPO", { status: "FAILED", error: "GITHUB_TOKEN not configured on the platform" });
    } else {
      try {
        const repo = await github.createRepo(company.slug, `${company.name} — built and operated by Adventure AI`);
        if (copy) {
          await github.putFile({
            repoFullName: repo.full_name,
            path: "index.html",
            content: renderLandingHtml({ companyName: company.name, copy }),
            message: "chore: initial landing page (Adventure AI Engineer)",
          });
        }
        await github.putFile({
          repoFullName: repo.full_name,
          path: "README.md",
          content: `# ${company.name}\n\nThis repository is operated by [Adventure AI](https://www.adventure-ai.in). You own it.\n`,
          message: "chore: add README",
        });
        repoFullName = repo.full_name;
        await record(companyId, "GITHUB_REPO", { status: "DONE", externalId: repo.full_name, meta: { htmlUrl: repo.html_url } });
        await logActivity({ companyId, agent: "ENGINEER", action: `Created GitHub repository ${repo.full_name} and pushed the landing page` });
      } catch (err) {
        await record(companyId, "GITHUB_REPO", { status: "FAILED", error: String(err).slice(0, 500) });
      }
    }
  }

  // 2. Vercel project linked to the repo
  if (!done.has("VERCEL_PROJECT")) {
    if (!vercel.vercelConfigured()) {
      await record(companyId, "VERCEL_PROJECT", { status: "FAILED", error: "VERCEL_TOKEN not configured on the platform" });
    } else if (!repoFullName) {
      await record(companyId, "VERCEL_PROJECT", { status: "FAILED", error: "GitHub repo unavailable — cannot link project" });
    } else {
      try {
        const { project, url } = await vercel.createProject({ name: company.slug, repoFullName });
        await record(companyId, "VERCEL_PROJECT", { status: "DONE", externalId: project.id, meta: { url } });
        if (company.landingPage) {
          await prisma.landingPage.update({ where: { companyId }, data: { deployedUrl: url } });
        }
        await logActivity({ companyId, agent: "ENGINEER", action: `Deployed the landing page to ${url}` });
      } catch (err) {
        await record(companyId, "VERCEL_PROJECT", { status: "FAILED", error: String(err).slice(0, 500) });
      }
    }
  }

  // 3–5. Later-phase resources — recorded as PENDING for transparency.
  for (const r of ["DB_SCHEMA", "EMAIL_IDENTITY", "RAZORPAY_LINKED_ACCOUNT"] as const) {
    if (!done.has(r)) await record(companyId, r, { status: "PENDING" });
  }

  // Activate: agents on, company running.
  await prisma.$transaction([
    prisma.company.update({ where: { id: companyId }, data: { status: "ACTIVE" } }),
    prisma.agentState.updateMany({ where: { companyId }, data: { enabled: true, pausedAt: null } }),
  ]);
  await logActivity({ companyId, agent: "ORCHESTRATOR", action: "Company activated — all agents online. First daily cycle starts shortly." });
  await saveMemory({
    companyId,
    agent: "ORCHESTRATOR",
    kind: "event",
    content: `Company activated on ${new Date().toISOString().slice(0, 10)}. Repo: ${repoFullName ?? "not provisioned"}.`,
  });
}
