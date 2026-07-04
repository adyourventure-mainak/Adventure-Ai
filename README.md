# Adventure AI

Autonomous AI system that plans, builds, markets, and operates online businesses —
"an AI co-founder that runs your company 24/7". Hosted at **adventureadvertising.in**.

## Monorepo layout

See [STRUCTURE.md](./STRUCTURE.md) for the full tree and design decisions.

- `apps/web` — Next.js 14 App Router (marketing site + dashboard + API) → Vercel
- `apps/worker` — BullMQ agent workers → Railway (Phase 1: queue scaffold + heartbeat)
- `packages/db` — Prisma schema, tenant-scoped client, credit ledger, RLS SQL
- `packages/agents` — Claude client, activity logging, guardrails, onboarding generation
- `packages/core` — plans/pricing (paise), Razorpay client + signature verification, shared zod types

## Setup

```bash
corepack enable                # pnpm
pnpm install
cp .env.example .env           # fill in Supabase / Anthropic / Razorpay keys
pnpm db:generate               # prisma generate
pnpm db:migrate                # create schema (uses DIRECT_URL)
psql "$DIRECT_URL" -f packages/db/prisma/rls.sql   # RLS + pgvector index + append-only triggers
pnpm dev                       # web on :3000
pnpm dev:worker                # worker (needs REDIS_URL)
```

Supabase prerequisites:
- Enable the `vector` extension (Database → Extensions).
- Enable Google OAuth + email magic links (Auth → Providers), and add
  `http://localhost:3000/auth/callback` + production URL to redirect allowlist.

Razorpay prerequisites:
- Create two plans (₹3,999/mo, ₹7,999/mo) and put their ids in `RAZORPAY_PLAN_PRO/SCALE`.
- Point a webhook at `/api/webhooks/razorpay` with events: `subscription.activated`,
  `subscription.charged`, `subscription.halted`, `subscription.cancelled`,
  `payment.captured`, `transfer.processed`; set `RAZORPAY_WEBHOOK_SECRET`.

## Phase status

- ✅ Phase 1 — auth, multi-tenant schema, onboarding + AI idea generation, landing page
  generator (preview), marketing site, Razorpay subscriptions + idempotent webhooks,
  credit ledger, activity log, worker scaffold. (LLM provider: OpenAI, `OPENAI_MODEL`.)
- ✅ Phase 2 — Orchestrator (daily brief + task dispatch) + Engineer (NL landing-page
  edits, repo commits) agents, pgvector memory (save/recall via embeddings), live SSE
  activity feed, on-demand tasks (1 credit, auto-refund on failure), GitHub/Vercel
  provisioning on upgrade, DB-driven worker scheduler (staggered daily cycles).
  Worker needs Redis (`REDIS_URL`); provisioning needs `GITHUB_TOKEN`/`VERCEL_TOKEN` —
  it degrades gracefully (records FAILED, company still activates) without them.
- ✅ Phase 3 — Social (posts, autonomy-gated), Email Outreach (always founder-approved —
  deliberate anti-spam guardrail), Support (reactive replies via dashboard form, saves
  customer facts to memory) agents; approvals inbox (approve / edit-first / reject at
  `/c/[slug]/approvals`); approved tasks resume through the same queue (web stays
  Redis-free — approval flips the task back to PENDING, scheduler re-queues, runner
  ships the approved/edited draft). Publishing/sending degrades gracefully until
  social/email integrations connect (approved content recorded as ready-to-ship).
- ✅ Phase 4 — Research (findings → shared memory), Finance (real numbers from the DB —
  ledger, LLM spend, transfers, throughput — LLM only narrates; writes daily KpiSnapshot),
  Ads (OFF until `adBudgetCapP > 0`; every budget founder-approved via AD_BUDGET_CHANGE;
  daily budget hard-clamped to cap/30) agents; credit-pack purchases (order API +
  billing-page checkout; webhook `payment.captured` grants via ledger); Razorpay Route
  revenue share (payments with `notes.type=business_revenue` split 80/20 —
  TransferRecord first as idempotency anchor, transfer only when the company's
  RAZORPAY_ROUTE integration has a linked `accountId`; `transfer.processed/failed/reversed`
  webhooks update settlement status).
- ✅ Phase 5 — Admin panel at `/admin` (isAdmin-gated: platform totals, per-company
  pause/resume, ad-cap setting, Razorpay Route linked-account entry — closes the Phase 4
  gap); public read-only feed at `/live/[slug]` (isPublic activity only — drafts,
  financials and customer conversations never appear; DRAFT companies 404); full data
  export at `GET /api/companies/[slug]/export` (owner-only JSON download; memory without
  embeddings, integrations without secrets; each export recorded in data_exports).
