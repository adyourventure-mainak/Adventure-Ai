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
