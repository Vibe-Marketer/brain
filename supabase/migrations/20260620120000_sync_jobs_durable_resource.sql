-- Migration: Extend sync_jobs into a durable, provider-agnostic resource (IMP-03)
-- Purpose: Phases 27 (observable jobs) and 28 (resumable sync-all) read/write
--          source_app, org/workspace scope, mode, date range, provider_cursor,
--          and last_heartbeat_at. These columns must exist and be org-isolated
--          before those phases can build.
-- Author: GSD executor (Phase 24, Plan 02)
-- Date: 2026-06-20
--
-- STRICTLY ADDITIVE. Verified against live prod (ref vltmrnjsubfzrgrtdqey):
--   - sync_jobs already has `error` (TEXT) and `skipped_count` — do NOT touch.
--   - recording_ids / synced_ids / failed_ids are already TEXT[] — never retype.
--   - sync_jobs is already a member of the supabase_realtime publication with ALL
--     columns (prattrs IS NULL → new columns auto-replicate). Verify, do NOT re-add.
--   - sync_jobs already has the user_id policy "Users can read own sync jobs".
--     KEEP IT. The org policy below is ADDED ALONGSIDE it. Postgres permissive
--     policies are OR-combined.

-- ============================================================================
-- 1. ADDITIVE COLUMNS (all nullable/defaulted so in-flight jobs stay readable)
-- ============================================================================
ALTER TABLE public.sync_jobs
  ADD COLUMN IF NOT EXISTS source_app        TEXT,
  ADD COLUMN IF NOT EXISTS organization_id   UUID,
  ADD COLUMN IF NOT EXISTS workspace_id      UUID,
  ADD COLUMN IF NOT EXISTS source_id         UUID,
  ADD COLUMN IF NOT EXISTS mode              TEXT DEFAULT 'selected',
  ADD COLUMN IF NOT EXISTS date_start        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_end          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_cursor   TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- ============================================================================
-- 2. NON-DESTRUCTIVE BACKFILL OF EXISTING ROWS
-- ============================================================================
-- Every prior job was a Fathom selected-import (per RESEARCH live introspection).
-- Backfill source_app + mode only. Do NOT backfill organization_id — leave it
-- NULL where unknown so in-flight/legacy jobs remain readable via the retained
-- user_id policy (see RLS section below).
UPDATE public.sync_jobs
SET source_app = COALESCE(source_app, 'fathom'),
    mode       = COALESCE(mode, 'selected')
WHERE source_app IS NULL OR mode IS NULL;

-- ============================================================================
-- 3. INDEX FOR ORG-SCOPED POLLING (later phases poll active jobs per org)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sync_jobs_organization_status
  ON public.sync_jobs (organization_id, status);

-- ============================================================================
-- 4. ROW LEVEL SECURITY — ADD org policy ALONGSIDE the retained user policy
-- ============================================================================
-- The existing policy "Users can read own sync jobs" (FOR SELECT, auth.uid() =
-- user_id) is RETAINED and NOT modified here.
--
-- BOTH policies are PERMISSIVE, so Postgres OR-combines them: a row is visible
-- if EITHER the user_id policy OR the org policy passes.
--
-- WHY THIS MATTERS FOR LEGACY ROWS: legacy/backfilled rows carry
-- organization_id = NULL (no org to assign). The org-scoped predicate
-- is_organization_member(organization_id, auth.uid()) does NOT match a NULL
-- organization_id — so those rows would VANISH under an org-only policy.
-- Because the user_id policy is RETAINED and OR-combined, each owner still sees
-- their own legacy NULL-org rows. New org-scoped rows are ADDITIONALLY isolated
-- so another org's tenant JWT sees zero of them.
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_jobs'
      AND policyname = 'sync_jobs_org_isolation'
  ) THEN
    CREATE POLICY sync_jobs_org_isolation
      ON public.sync_jobs FOR SELECT
      TO authenticated
      USING (is_organization_member(organization_id, auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 5. REALTIME MEMBERSHIP — VERIFY, DO NOT BLINDLY RE-ADD
-- ============================================================================
-- sync_jobs is already a member of supabase_realtime with ALL columns (verified
-- against prod). Blindly running ALTER PUBLICATION ... ADD TABLE would error
-- ("relation is already member of publication"). Guard with pg_publication_tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sync_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
  END IF;
END $$;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================
COMMENT ON COLUMN public.sync_jobs.source_app        IS 'Provider app slug (e.g. fathom, zoom) — provider-agnostic; backfilled to fathom for legacy rows';
COMMENT ON COLUMN public.sync_jobs.organization_id   IS 'Owning org; NULL for legacy/in-flight rows (still visible to owner via the retained user_id policy)';
COMMENT ON COLUMN public.sync_jobs.workspace_id      IS 'Target workspace for the import, if scoped';
COMMENT ON COLUMN public.sync_jobs.source_id         IS 'Import source (connector instance) id, if applicable';
COMMENT ON COLUMN public.sync_jobs.mode              IS 'Import mode: selected | all | date-range (default selected)';
COMMENT ON COLUMN public.sync_jobs.date_start        IS 'Inclusive start of a date-range sync';
COMMENT ON COLUMN public.sync_jobs.date_end          IS 'Inclusive end of a date-range sync';
COMMENT ON COLUMN public.sync_jobs.provider_cursor   IS 'Opaque provider pagination cursor for resumable sync-all (Phase 28)';
COMMENT ON COLUMN public.sync_jobs.last_heartbeat_at IS 'Last liveness heartbeat; used to detect silent mid-run death (Phase 27/28)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
