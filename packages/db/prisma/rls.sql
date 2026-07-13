-- Second-layer tenant isolation + immutability guarantees.
-- Run once after `prisma migrate deploy` (or include as a manual migration):
--   psql "$DIRECT_URL" -f prisma/rls.sql
--
-- The app connects as the `postgres`/service role which BYPASSES RLS; these
-- policies protect against any access via Supabase's PostgREST/anon paths and
-- any future lower-privileged connection. Data API access should stay
-- disabled for these tables regardless.

-- pgvector index for memory retrieval. The ivfflat build needs more working
-- memory than Supabase's 32 MB default (fails with SQLSTATE 54000 otherwise),
-- so raise it for this session first.
SET maintenance_work_mem = '128MB';
CREATE INDEX IF NOT EXISTS memory_entries_embedding_idx
  ON memory_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS everywhere; no policies for anon/authenticated = deny by default.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- activity_log and credit_ledger are non-rewritable: no row may ever be
-- UPDATEd (balances/log entries can never be silently altered). DELETE is
-- deliberately still allowed — it is required for the DPDP/GDPR erasure
-- cascade the worker runs on company/account deletion (scheduler.ts), and the
-- app itself only ever INSERTs into these tables in normal operation. RLS
-- (above) already denies the anon/PostgREST path entirely, so the only writer
-- is the trusted service role.
CREATE OR REPLACE FUNCTION forbid_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (no UPDATE)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Replace the older name if a previous version installed it.
DROP TRIGGER IF EXISTS activity_log_immutable ON activity_log;
CREATE TRIGGER activity_log_immutable
  BEFORE UPDATE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION forbid_update();

DROP TRIGGER IF EXISTS credit_ledger_immutable ON credit_ledger;
CREATE TRIGGER credit_ledger_immutable
  BEFORE UPDATE ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
