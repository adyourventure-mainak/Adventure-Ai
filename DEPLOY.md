# Deploying Adventure AI

## Web → Vercel (done — 2026-07-04)

- Project: **adventure-ai** (team "Adventure AI", `prj_i86JepEL1eGJWjK0Mw034cgBhpjc`)
- Production URL: https://www.adventure-ai.in (Vercel: adventure-ai-nine.vercel.app)
- Root directory: `apps/web`; 12 env vars set for production+preview
  (DB, Supabase, OpenAI, Razorpay — NOT GitHub/Vercel tokens, those are worker-only).
- Deployed via CLI (`pnpm dlx vercel deploy --prod`). To move to git-triggered
  deploys: create a GitHub repo, `git remote add origin … && git push`, then
  connect it in Vercel project settings → Git.
- `packages/db` has a `postinstall: prisma generate`; `schema.prisma` pins
  `binaryTargets = ["native", "rhel-openssl-3.0.x", "debian-openssl-3.0.x"]`
  so Prisma engines exist on Vercel (rhel) and in the worker Docker image (debian).

## Worker → Railway (done — 2026-07-04)

- Project **adventure-ai-worker** (`d0a11cf1-a0f7-40c5-9fa5-1fd4964c4eb5`),
  production environment (`ae5dec6c-…`), account `adyourventure@gmail.com`.
- Two services:
  - **redis** — `redis:7-alpine`, `--requirepass <pw> --appendonly yes`,
    reached over private networking at `redis.railway.internal:6379`.
  - **worker** — built from `apps/worker/Dockerfile` (config in root
    `railway.json`), deployed via `railway up` (no GitHub repo yet, so code is
    uploaded from local). 8 env vars set: DATABASE_URL, DIRECT_URL,
    OPENAI_API_KEY, OPENAI_MODEL, GITHUB_TOKEN, VERCEL_TOKEN, VERCEL_TEAM_ID,
    REDIS_URL.
- Boot log confirmed clean: `[worker] booted … processors: provisioning,
  orchestrator, engineer, social, email-outreach, support, research, finance,
  ads. scheduler: 60s tick.`
- **Gotcha fixed:** Railway private networking is IPv6-only; ioredis needed
  `family: 0` (`apps/worker/src/queues.ts`) or it fails with
  `ENOTFOUND redis.railway.internal`.

### Redeploying the worker later

```bash
export RAILWAY_API_TOKEN=<account token>
railway link -p d0a11cf1-a0f7-40c5-9fa5-1fd4964c4eb5 -e production -s worker
railway up --detach --service worker
```

Or connect the GitHub repo (once created) in the service's Settings → Source
for push-to-deploy, same as recommended for Vercel.

## Razorpay webhook (manual — live account change)

Dashboard → Settings → Webhooks → Add:
- URL: `https://www.adventure-ai.in/api/webhooks/razorpay`
- Secret: the value of `RAZORPAY_WEBHOOK_SECRET`
- Events: `subscription.activated/charged/halted/paused/cancelled/completed`,
  `payment.captured`, `transfer.processed/failed/reversed`

Or via API:

```bash
curl -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" -X POST https://api.razorpay.com/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.adventure-ai.in/api/webhooks/razorpay","secret":"<RAZORPAY_WEBHOOK_SECRET>","events":{"subscription.activated":true,"subscription.charged":true,"subscription.halted":true,"subscription.paused":true,"subscription.cancelled":true,"subscription.completed":true,"payment.captured":true,"transfer.processed":true,"transfer.failed":true,"transfer.reversed":true}}'
```

## Custom domain

Vercel project → Settings → Domains → add `adventure-ai.in`
(+ `www`), then point DNS: `A 76.76.21.21` / `CNAME cname.vercel-dns.com`.
Update `NEXT_PUBLIC_APP_URL` env var and the webhook URL afterwards.

## Pre-launch (do these!)

- [ ] **Rotate every credential that was pasted in chat**: OpenAI key, Razorpay
      key secret + webhook secret, Supabase DB password, GitHub PAT, Vercel token —
      then update Vercel env vars + Railway variables + `apps/web/.env.local`.
- [ ] Make yourself admin:
      `UPDATE users SET "isAdmin" = true WHERE email = '008.mainak@gmail.com';`
- [ ] Decide: keep test company "Chai Break Club" as a public demo or delete it.
