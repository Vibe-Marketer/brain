-- Migration: Add nightly-critic review columns to runner_runs
-- Purpose: RootCauseAnalysis session 2026-07-29 — autopilot's existing
--          weekly digest (qa/weekly-digest.ts) is a deterministic metrics
--          rollup with zero LLM judgment calls. This adds the columns a new
--          nightly critic agent needs to record, per completed run, whether
--          a permanent/correct/helpful fix actually shipped, a 1-10 quality
--          score, freeform notes (what a better fix would have looked like),
--          and when the review happened. Additive only; no existing column
--          touched.
-- Date: 2026-07-29

ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS critic_verdict text,
  ADD COLUMN IF NOT EXISTS critic_score smallint,
  ADD COLUMN IF NOT EXISTS critic_notes text,
  ADD COLUMN IF NOT EXISTS critic_reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_critic_verdict_check'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_critic_verdict_check
      CHECK (critic_verdict IS NULL OR critic_verdict IN (
        'permanent-fix', 'partial-fix', 'not-a-fix', 'correctly-escalated', 'n-a'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_critic_score_range'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_critic_score_range
      CHECK (critic_score IS NULL OR (critic_score BETWEEN 1 AND 10));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS runner_runs_critic_reviewed_at_idx
  ON public.runner_runs (critic_reviewed_at)
  WHERE critic_reviewed_at IS NOT NULL;
