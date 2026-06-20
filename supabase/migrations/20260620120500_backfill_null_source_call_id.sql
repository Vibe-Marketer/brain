-- Migration: Backfill NULL source_call_id on recordings (Phase 24 / IMP-02 gap)
-- Purpose: Close the NULL-source_call_id gap that silently escapes the EXISTING
--          org-scoped unique constraint `recordings_source_dedup`. Postgres treats
--          NULLs as distinct in a UNIQUE constraint, so two NULL-source_call_id rows
--          for the same provider call never collide -- they can be double-imported.
--          This backfills source_call_id from fathom_provider_id::text for fathom rows
--          where derivable, and reports/documents the residual gap.
-- Author: GSD executor (Phase 24, Plan 03)
-- Date: 2026-06-20
--
-- ============================================================================
-- !! DO NOT RECREATE THE CONSTRAINT !!
-- ============================================================================
-- The org-scoped unique constraint
--     recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)
-- ALREADY EXISTS in prod (created in migration 20260303000004). It is LIVE with
-- ZERO blocking duplicate rows. This migration MUST NOT add, drop, or recreate it
-- (doing so risks a write outage and violates additive-only discipline). This file
-- only backfills DATA -- it touches no constraints, indexes, or column types.
--
-- ============================================================================
-- BACKFILL: derive source_call_id from fathom_provider_id for fathom rows
-- ============================================================================
-- recordings.fathom_provider_id is BIGINT (Fathom's numeric id).
-- recordings.source_call_id is TEXT.
-- We cast EXPLICITLY with ::text -- never an implicit TEXT/BIGINT coercion, and
-- never parseInt/Number on an id (the dual-recording-ID rule). source_call_id stays
-- TEXT end-to-end.
--
-- Idempotent: the `source_call_id IS NULL` guard makes a second run a no-op (rows
-- backfilled on the first run no longer match the WHERE clause).
UPDATE public.recordings
SET source_call_id = fathom_provider_id::text
WHERE source_call_id IS NULL
  AND source_app IN ('fathom', 'fathom-paste')
  AND fathom_provider_id IS NOT NULL;

-- ============================================================================
-- RESIDUAL-GAP REPORT
-- ============================================================================
-- Count rows that STILL have NULL source_call_id after the backfill (rows with
-- both source_call_id AND fathom_provider_id NULL -- a fathom/paste row whose
-- provider id was never captured, so there is nothing to derive the key from).
-- Surfaced via RAISE NOTICE so the operator sees the bounded residual on every run.
DO $$
DECLARE
  residual_total      BIGINT;
  residual_fathom     BIGINT;
BEGIN
  SELECT count(*)
    INTO residual_total
    FROM public.recordings
   WHERE source_call_id IS NULL;

  SELECT count(*)
    INTO residual_fathom
    FROM public.recordings
   WHERE source_call_id IS NULL
     AND source_app IN ('fathom', 'fathom-paste');

  RAISE NOTICE '[24-03 backfill] residual recordings with NULL source_call_id: % total (% fathom/fathom-paste)',
    residual_total, residual_fathom;
END $$;

-- ============================================================================
-- KNOWN BOUNDED GAP (documented, not silently left)
-- ============================================================================
-- Rows that still have BOTH source_call_id AND fathom_provider_id NULL after this
-- backfill are a known, bounded gap. They have no provider id to re-fetch, so they
-- CANNOT be double-imported via the connector path (the connector keys on the
-- provider id) -- the duplicate-escape risk does not apply to them.
--
-- A `UNIQUE NULLS NOT DISTINCT` upgrade (Postgres 15+) would also close the gap at
-- the constraint level, but it is a DESTRUCTIVE constraint change (drop + recreate)
-- and is therefore OUT OF SCOPE for this additive-only data migration. It is
-- intentionally deferred.
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
