// Minimal GitHub REST client for provisioning + Engineer commits.
// Uses GITHUB_TOKEN (fine-grained PAT or classic with `repo` scope).

const API = "https://api.github.com";

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface GhRepo {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
}

/** Delete a repo (company deletion). 204 on success; 404 treated as done. */
export async function deleteRepo(repoFullName: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  const res = await fetch(`${API}/repos/${repoFullName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub DELETE /repos/${repoFullName} failed (${res.status})`);
  }
}

/** Fetch a repo (used to get the numeric id Vercel needs to trigger a deploy). */
export async function getRepo(repoFullName: string): Promise<GhRepo> {
  return gh<GhRepo>(`/repos/${repoFullName}`);
}

/** Create a repo under the token's user (platform account; ownership transfer is a later phase). */
export async function createRepo(name: string, description: string): Promise<GhRepo> {
  return gh<GhRepo>("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      private: true,
      auto_init: false,
      has_issues: true,
      has_wiki: false,
    }),
  });
}

/** Create or update a file via the contents API (handles the update-sha dance). */
export async function putFile(params: {
  repoFullName: string;
  path: string;
  content: string;
  message: string;
}): Promise<void> {
  const { repoFullName, path, content, message } = params;
  let sha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(`/repos/${repoFullName}/contents/${path}`);
    sha = existing.sha;
  } catch {
    // File doesn't exist yet — plain create.
  }
  await gh(`/repos/${repoFullName}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
}
