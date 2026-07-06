# Adventure AI — project structure (proposed)

Turborepo + pnpm workspaces monorepo. Two deployables (Vercel web, Railway worker)
sharing one Prisma client and one agent core.

```
adventure-ai/
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
│
├── apps/
│   ├── web/                          # Next.js 14 App Router → Vercel
│   │   ├── app/
│   │   │   ├── (marketing)/          # www.adventure-ai.in public site
│   │   │   │   ├── page.tsx          # hero, live demo feed, pricing, FAQ
│   │   │   │   ├── pricing/page.tsx
│   │   │   │   └── live/page.tsx     # public read-only activity feed (Phase 5)
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx    # magic link + Google OAuth
│   │   │   │   └── auth/callback/route.ts
│   │   │   ├── (dashboard)/
│   │   │   │   ├── onboarding/       # idea input / "Surprise me" flow
│   │   │   │   ├── [companySlug]/
│   │   │   │   │   ├── page.tsx      # overview: KPIs + daily brief
│   │   │   │   │   ├── activity/     # live stream (SSE)
│   │   │   │   │   ├── tasks/
│   │   │   │   │   ├── approvals/
│   │   │   │   │   ├── finance/      # rev-share statement (Phase 4)
│   │   │   │   │   └── settings/
│   │   │   │   └── billing/          # upgrade, credit packs
│   │   │   ├── admin/                # operator panel (Phase 5)
│   │   │   └── api/
│   │   │       ├── webhooks/razorpay/route.ts
│   │   │       ├── webhooks/supabase-auth/route.ts   # mirror auth.users → users
│   │   │       ├── companies/...     # CRUD + idea generation endpoints
│   │   │       ├── billing/...       # create subscription / order
│   │   │       └── activity/stream/route.ts          # SSE
│   │   ├── components/               # shadcn/ui + app components
│   │   ├── lib/                      # supabase client, auth helpers, api utils
│   │   └── middleware.ts             # session refresh + route guards
│   │
│   └── worker/                       # Node service → Railway (with Redis)
│       ├── src/
│       │   ├── index.ts              # boots queues + schedulers
│       │   ├── queues.ts             # one BullMQ queue per agent
│       │   ├── schedulers.ts         # staggered repeatable jobs per company
│       │   └── processors/
│       │       ├── orchestrator.ts   # Phase 2
│       │       ├── engineer.ts       # Phase 2
│       │       ├── social.ts         # Phase 3
│       │       ├── emailOutreach.ts  # Phase 3
│       │       ├── support.ts        # Phase 3
│       │       ├── planner.ts        # Phase 3
│       │       ├── ads.ts            # Phase 4
│       │       ├── finance.ts        # Phase 4
│       │       └── research.ts       # Phase 4
│       └── Dockerfile
│
├── packages/
│   ├── db/                           # @adventure/db
│   │   ├── prisma/schema.prisma      # ← the schema under review
│   │   ├── prisma/migrations/        # includes raw SQL for RLS + ivfflat index
│   │   └── src/
│   │       ├── client.ts             # tenant-scoped Prisma client factory:
│   │       │                         #   forCompany(id) → $extends query filter
│   │       │                         #   injecting companyId on every op
│   │       └── credits.ts            # ledger helpers (grant/consume/refund, tx-safe)
│   │
│   ├── agents/                       # @adventure/agents — shared agent core
│   │   ├── src/
│   │   │   ├── claude.ts             # Anthropic client, model via env, usage capture
│   │   │   ├── memory.ts             # write/retrieve memory (pgvector similarity)
│   │   │   ├── activity.ts           # activity_log writer (append-only)
│   │   │   ├── guardrails.ts         # token caps, spend caps, kill switch
│   │   │   └── prompts/              # one prompt module per agent
│   │   └── package.json
│   │
│   └── core/                         # @adventure/core — shared logic, no I/O deps
│       ├── src/
│       │   ├── plans.ts              # tier definitions, prices (paise), limits
│       │   ├── razorpay.ts           # API client, signature verification
│       │   └── types.ts              # zod schemas shared web ↔ worker
│       └── package.json
```

## Key decisions baked in

- **Tenant isolation, two layers**: `packages/db/client.ts` exposes only
  company-scoped clients (Prisma client extension auto-filters/injects
  `companyId`); Supabase RLS policies (raw SQL migration) are the backstop for
  anything touching Postgres outside Prisma. `activity_log` gets
  INSERT-only policies (immutability enforced in DB, not just convention).
- **Money in paise everywhere** (Int). Formatting to ₹ happens only in UI.
- **Credits as append-only ledger** — balance is derived, never a mutable column;
  consume/refund wrapped in a serializable transaction with the task row.
- **Webhook idempotency** via `webhook_events` keyed on Razorpay's event id:
  insert-first, skip if exists, then process.
- **Worker is the only place agents run** — web never calls Claude except for
  onboarding idea/copy generation (fast, interactive, still logged to
  activity_log with token counts).
- **Phase 1 delivers**: marketing site, auth, onboarding + idea generation,
  landing-page copy generator (preview only), Razorpay subscription checkout +
  webhooks, and the schema/migrations above. Worker app is scaffolded but only
  runs a no-op heartbeat until Phase 2.
