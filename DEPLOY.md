# Deploying Adventure AI

## Web → Vercel (done — 2026-07-04)

- Project: **adventure-ai** (team "Adventure AI", `prj_i86JepEL1eGJWjK0Mw034cgBhpjc`)
- Production URL: https://adventure-ai-nine.vercel.app
- Root directory: `apps/web`; 12 env vars set for production+preview
  (DB, Supabase, OpenAI, Razorpay — NOT GitHub/Vercel tokens, those are worker-only).
- Deployed via CLI (`pnpm dlx vercel deploy --prod`). To move to git-triggered
  deploys: create a GitHub repo, `git remote add origin … && git push`, then
  connect it in Vercel project settings → Git.
- `packages/db` has a `postinstall: prisma generate`; `schema.prisma` pins
  `binaryTargets = ["native", "rhel-openssl-3.0.x", "debian-openssl-3.0.x"]`
  so Prisma engines exist on Vercel (rhel) and in the worker Docker image (debian).

## Worker → Railway (manual steps)

1. `npm i -g @railway/cli && railway login` (or set `RAILWAY_TOKEN`).
2. `railway init` in the repo root → new project "adventure-ai-worker".
3. Add the **Redis** plugin (managed Redis) — it injects `REDIS_URL`.
4. Create a service from this repo: root `/`, Dockerfile `apps/worker/Dockerfile`.
5. Service variables: `DATABASE_URL`, `DIRECT_URL`, `OPENAI_API_KEY`,
   `OPENAI_MODEL`, `GITHUB_TOKEN`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`
   (copy values from `apps/web/.env.local`; `REDIS_URL` comes from the plugin).
6. Deploy. Boot log should say: `[worker] booted. queues: …` and
   `processors: provisioning, orchestrator, engineer, social, email-outreach,
   support, research, finance, ads`.

## Razorpay webhook (manual — live account change)

Dashboard → Settings → Webhooks → Add:
- URL: `https://adventure-ai-nine.vercel.app/api/webhooks/razorpay`
- Secret: the value of `RAZORPAY_WEBHOOK_SECRET`
- Events: `subscription.activated/charged/halted/paused/cancelled/completed`,
  `payment.captured`, `transfer.processed/failed/reversed`

Or via API:

```bash
curl -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" -X POST https://api.razorpay.com/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://adventure-ai-nine.vercel.app/api/webhooks/razorpay","secret":"<RAZORPAY_WEBHOOK_SECRET>","events":{"subscription.activated":true,"subscription.charged":true,"subscription.halted":true,"subscription.paused":true,"subscription.cancelled":true,"subscription.completed":true,"payment.captured":true,"transfer.processed":true,"transfer.failed":true,"transfer.reversed":true}}'
```

## Custom domain

Vercel project → Settings → Domains → add `adventureadvertising.in`
(+ `www`), then point DNS: `A 76.76.21.21` / `CNAME cname.vercel-dns.com`.
Update `NEXT_PUBLIC_APP_URL` env var and the webhook URL afterwards.

## Pre-launch (do these!)

- [ ] **Rotate every credential that was pasted in chat**: OpenAI key, Razorpay
      key secret + webhook secret, Supabase DB password, GitHub PAT, Vercel token —
      then update Vercel env vars + Railway variables + `apps/web/.env.local`.
- [ ] Make yourself admin:
      `UPDATE users SET "isAdmin" = true WHERE email = '008.mainak@gmail.com';`
- [ ] Decide: keep test company "Chai Break Club" as a public demo or delete it.
