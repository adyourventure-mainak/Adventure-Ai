-- Second-layer tenant isolation + immutability guarantees.
-- Run once after `prisma migrate deploy` (or include as a manual migration):
--   psql "$DIRECT_URL" -f prisma/rls.sql
--
-- The app connects as the `postgres`/service role which BYPASSES RLS; these
-- policies protect against any access via Supabase's PostgREST/anon paths and
-- any future lower-privileged connection. Data API access should stay
-- disabled for these tables regardless.

-- pgvector index for memory retrieval
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

-- activity_log is append-only even for table owners:
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_log_immutable ON activity_log;
CREATE TRIGGER activity_log_immutable
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- credit ledger is append-only as well
DROP TRIGGER IF EXISTS credit_ledger_immutable ON credit_ledger;
CREATE TRIGGER credit_ledger_immutable
  BEFORE UPDATE OR DELETE ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
