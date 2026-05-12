-- Migration: Fathom mirror columns (mirror_version + import_source_id)
-- Purpose:   Phase 39 Fathom Mirror — enable per-source routing + future schema migrations
-- Date:      2026-05-12
-- Author:    Claude (Phase 39 plan 39-01)
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Safe to re-run.

BEGIN;

-- ============================================================================
-- COLUMN: mirror_version (schema migration tracker)
-- ============================================================================
ALTER TABLE public.fathom_raw_calls
  ADD COLUMN IF NOT EXISTS mirror_version INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.fathom_raw_calls.mirror_version IS
  'Mirror schema version. Incremented when fathom-reconcile detects new fields from Fathom API. Phase 39.';

-- ============================================================================
-- COLUMN: import_source_id (multi-account routing)
-- ============================================================================
ALTER TABLE public.fathom_raw_calls
  ADD COLUMN IF NOT EXISTS import_source_id UUID
    REFERENCES public.import_sources(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.fathom_raw_calls.import_source_id IS
  'Which Fathom OAuth import_source row brought this call in. NULL for legacy rows pre-Phase-39. Phase 39.';

-- ============================================================================
-- BACKFILL: import_source_id from user primary active fathom source
-- ============================================================================
WITH primary_fathom_source AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    id AS source_id
  FROM public.import_sources
  WHERE source_app = 'fathom'
    AND is_active = true
  ORDER BY user_id, updated_at DESC NULLS LAST
)
UPDATE public.fathom_raw_calls f
SET import_source_id = pfs.source_id
FROM primary_fathom_source pfs
WHERE pfs.user_id = f.user_id
  AND f.import_source_id IS NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fathom_raw_calls_import_source
  ON public.fathom_raw_calls(import_source_id)
  WHERE import_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fathom_raw_calls_synced_at
  ON public.fathom_raw_calls(synced_at DESC);

-- Composite index for per-source reconcile diff (cron: most recent first per source)
CREATE INDEX IF NOT EXISTS idx_fathom_raw_calls_source_synced
  ON public.fathom_raw_calls(import_source_id, synced_at DESC)
  WHERE import_source_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION (run manually after migration)
-- ============================================================================
-- SELECT
--   count(*) FILTER (WHERE import_source_id IS NOT NULL) AS rows_with_source,
--   count(*) FILTER (WHERE import_source_id IS NULL)     AS rows_without_source,
--   count(*) AS total
-- FROM fathom_raw_calls;
--
-- Expected: rows_without_source approaches 0 for users with an active fathom import_source.
