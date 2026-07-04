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

export interface VercelProject {
  id: string;
  name: string;
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
