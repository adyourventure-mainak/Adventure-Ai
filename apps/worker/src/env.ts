import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";

// Local dev convenience: reuse the web app's env so there's one place to edit
// secrets. On Railway, env vars come from the service config and these files
// don't exist.
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../web/.env.local"),
  path.resolve(process.cwd(), "../../apps/web/.env.local"),
];
for (const p of candidates) {
  if (fs.existsSync(p)) config({ path: p, override: false });
}

// Fail fast if a critical variable is missing — the worker should refuse to
// start rather than boot and silently fail every job. Feature-gated vars
// (SUPABASE_*, GITHUB_TOKEN, VERCEL_TOKEN, RESEND_API_KEY) degrade gracefully
// and are intentionally not listed.
const REQUIRED = ["DATABASE_URL", "REDIS_URL", "OPENAI_API_KEY"] as const;
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(
    `[env] Worker refusing to start — missing required environment variable(s): ${missing.join(", ")}. ` +
      `Set them in the Railway service config (see .env.example).`,
  );
}
