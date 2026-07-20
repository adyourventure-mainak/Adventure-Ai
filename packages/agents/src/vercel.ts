// Minimal Vercel API client for provisioning company landing pages.
// Requires VERCEL_TOKEN; the Vercel account must have the GitHub app installed
// so projects can link to the repos the platform creates.

const API = "https://api.vercel.com";

export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN);
}

async function vc<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not configured");
  const teamId = process.env.VERCEL_TEAM_ID;
  const url = new URL(`${API}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Delete a project (company deletion). 404 treated as already gone. */
export async function deleteProject(idOrName: string): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not configured");
  const teamId = process.env.VERCEL_TEAM_ID;
  const url = new URL(`${API}/v9/projects/${idOrName}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Vercel DELETE project ${idOrName} failed (${res.status})`);
  }
}

export interface VercelProject {
  id: string;
  name: string;
}

export interface VercelDeployment {
  id: string;
  url: string;
  readyState?: string;
}

/**
 * Trigger a production deployment from the project's linked GitHub repo.
 * Linking a project alone does NOT deploy — Vercel only auto-builds on pushes
 * that arrive *after* the link exists, and the initial site push happens
 * before linking. Without this, the `.vercel.app` domain 404s with
 * DEPLOYMENT_NOT_FOUND until the next push. Idempotent to call again.
 */
export async function deployProject(params: {
  projectName: string;
  repoId: number;
  ref?: string;
}): Promise<VercelDeployment> {
  return vc<VercelDeployment>("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: params.projectName,
      target: "production",
      gitSource: { type: "github", repoId: params.repoId, ref: params.ref ?? "main" },
      // Static HTML at repo root — no build. Required on a project's first
      // deploy, else Vercel rejects with "missing_project_settings".
      projectSettings: {
        framework: null,
        buildCommand: null,
        installCommand: null,
        outputDirectory: ".",
      },
    }),
  });
}

// Company sites live on subdomains of the platform domain
// (<slug>.adventure-ai.in). The domain's DNS is on Vercel nameservers, so
// attaching the subdomain to a project auto-creates the record + SSL.
export const SITE_DOMAIN = process.env.COMPANY_SITE_DOMAIN ?? "adventure-ai.in";

/**
 * Attach <slug>.SITE_DOMAIN to a project. Idempotent: 409 (already attached
 * to this or another project we own) is treated as success only when it's
 * already on THIS project; other conflicts surface as errors.
 */
export async function addProjectDomain(projectIdOrName: string, domain: string): Promise<void> {
  try {
    await vc(`/v10/projects/${projectIdOrName}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });
  } catch (err) {
    // "domain_already_in_use" on the same project → fine.
    if (String(err).includes("already in use by one of your projects")) return;
    if (String(err).includes("(409)")) return;
    throw err;
  }
}

/**
 * Create a project linked to a GitHub repo; Vercel then deploys on every push.
 * Idempotent: if the project name is taken (409) — e.g. a previous provisioning
 * attempt partially succeeded — the existing project is fetched and reused.
 */
export async function createProject(params: {
  name: string;
  repoFullName: string;
}): Promise<{ project: VercelProject; url: string }> {
  let project: VercelProject;
  try {
    project = await vc<VercelProject>("/v10/projects", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        gitRepository: { type: "github", repo: params.repoFullName },
      }),
    });
  } catch (err) {
    if (!String(err).includes("(409)")) throw err;
    project = await vc<VercelProject>(`/v9/projects/${params.name}`);
  }
  return { project, url: `https://${project.name}.vercel.app` };
}
