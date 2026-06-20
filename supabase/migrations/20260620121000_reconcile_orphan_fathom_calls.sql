-- Migration: Reconcile orphan fathom_calls -- REPORT ONLY (Phase 24 / IMP-04)
-- Purpose: Identify fathom_calls rows that match `recordings` by NEITHER bridge path
--          and PERSIST them to a report table for manual operator review.
--          OPERATOR-LOCKED DECISION: the canonical reader EXCLUDES these orphans; this
--          migration does NOT fabricate (INSERT) recordings rows for them. Fabricating
--          rows would resurrect calls a user may have deliberately deleted.
-- Author: GSD executor (Phase 24, Plan 03)
-- Date: 2026-06-20
--
-- ============================================================================
-- BRIDGE PATHS (both must miss for a row to be an orphan)
-- ============================================================================
--   1. fathom_calls.recording_id            (BIGINT) -> recordings.fathom_provider_id (BIGINT)
--   2. fathom_calls.canonical_recording_id  (UUID)   -> recordings.id                 (UUID)
--
-- TYPE SAFETY: comparisons are BIGINT<->BIGINT and UUID<->UUID only. We NEVER cast a
-- BIGINT to UUID (that throws "invalid input syntax for type uuid"). A NULL
-- canonical_recording_id is treated as "no match" (NOT EXISTS naturally yields no row),
-- never coerced.
--
-- ============================================================================
-- REPORT TABLE (idempotent create; fathom_call_id is the PK arbiter)
-- ============================================================================
-- fathom_call_id is declared PRIMARY KEY so the INSERT below can use an explicit
-- `ON CONFLICT (fathom_call_id) DO NOTHING` -- a bare `ON CONFLICT DO NOTHING` with no
-- unique/PK arbiter would error ("there is no unique or exclusion constraint matching
-- the ON CONFLICT specification"). The PK is the chosen idempotency path.
-- Type matches fathom_calls.recording_id (BIGINT PRIMARY KEY of fathom_calls).
CREATE TABLE IF NOT EXISTS public.fathom_calls_orphan_report (
  fathom_call_id      BIGINT PRIMARY KEY,
  recording_id_bigint BIGINT,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fathom_calls_orphan_report IS
  'Phase 24 / IMP-04: fathom_calls rows that match recordings by NEITHER bridge path
   (recording_id BIGINT -> recordings.fathom_provider_id, AND canonical_recording_id UUID
   -> recordings.id). Operator-locked decision: these orphans are EXCLUDED from the
   canonical reader and surfaced here for MANUAL review -- they are NOT backfilled into
   recordings (no row fabrication). fathom_call_id is the PK arbiter for idempotent re-runs.';

-- ============================================================================
-- POPULATE THE REPORT (idempotent via the fathom_call_id PK arbiter)
-- ============================================================================
-- Re-running yields identical content: already-reported orphans hit the PK conflict
-- and are skipped (ON CONFLICT (fathom_call_id) DO NOTHING).
INSERT INTO public.fathom_calls_orphan_report (fathom_call_id, recording_id_bigint)
SELECT fc.recording_id, fc.recording_id
FROM public.fathom_calls fc
WHERE NOT EXISTS (
        -- Bridge path 1: BIGINT recording_id -> BIGINT recordings.fathom_provider_id
        SELECT 1
        FROM public.recordings r
        WHERE r.fathom_provider_id = fc.recording_id
      )
  AND NOT EXISTS (
        -- Bridge path 2: UUID canonical_recording_id -> UUID recordings.id
        -- (NULL canonical_recording_id -> NOT EXISTS is true -> treated as no-match,
        --  never cast a BIGINT to UUID)
        SELECT 1
        FROM public.recordings r
        WHERE fc.canonical_recording_id IS NOT NULL
          AND r.id = fc.canonical_recording_id
      )
ON CONFLICT (fathom_call_id) DO NOTHING;

-- ============================================================================
-- ORPHAN-COUNT REPORT (operator visibility)
-- ============================================================================
DO $$
DECLARE
  live_orphans     BIGINT;
  reported_orphans BIGINT;
BEGIN
  -- Current live orphan count (recomputed from the source-of-truth tables)
  SELECT count(*)
    INTO live_orphans
    FROM public.fathom_calls fc
   WHERE NOT EXISTS (
           SELECT 1 FROM public.recordings r
            WHERE r.fathom_provider_id = fc.recording_id
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.recordings r
            WHERE fc.canonical_recording_id IS NOT NULL
              AND r.id = fc.canonical_recording_id
         );

  SELECT count(*) INTO reported_orphans FROM public.fathom_calls_orphan_report;

  RAISE NOTICE '[24-03 reconcile] truly-orphan fathom_calls: % live, % persisted in fathom_calls_orphan_report (EXCLUDED from canonical reader; manual review only -- NOT backfilled)',
    live_orphans, reported_orphans;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
