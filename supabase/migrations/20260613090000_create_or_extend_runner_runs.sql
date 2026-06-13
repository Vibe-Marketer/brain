-- Migration: Create or extend runner_runs per-run ledger
-- Purpose: Phase 17 Plan 01 / ACT-04 — durable per-run observability for the
--          autopilot daemon. Generated Supabase types alone are not proof; this
--          migration creates or repairs the live table and RLS contract.
-- Date: 2026-06-13

-- The live project previously produced a generated runner_runs type without a
-- repo migration. Preserve any existing rows/columns and add the ACT-04 ledger
-- columns required by AdminTab and the daemon.
CREATE TABLE IF NOT EXISTS public.runner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_sec integer,
  ADD COLUMN IF NOT EXISTS est_cost text,
  ADD COLUMN IF NOT EXISTS gate_verdict text,
  ADD COLUMN IF NOT EXISTS gate_stage text,
  ADD COLUMN IF NOT EXISTS test_cmd text,
  ADD COLUMN IF NOT EXISTS test_exit integer,
  ADD COLUMN IF NOT EXISTS diff_stat text,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS fix_sha text,
  ADD COLUMN IF NOT EXISTS detail jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_ticket_id_fkey'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_ticket_id_fkey
      FOREIGN KEY (ticket_id)
      REFERENCES public.tickets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_duration_sec_nonnegative'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_duration_sec_nonnegative
      CHECK (duration_sec IS NULL OR duration_sec >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_runner_runs_started_at_desc
  ON public.runner_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_runner_runs_ticket_id
  ON public.runner_runs (ticket_id);

ALTER TABLE public.runner_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view runner runs" ON public.runner_runs;
CREATE POLICY "Admins can view runner runs" ON public.runner_runs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- No authenticated INSERT/UPDATE/DELETE policies are defined. The daemon writes
-- with the service-role key, which bypasses RLS; reporters get no access path.

COMMENT ON TABLE public.runner_runs IS
  'Autopilot per-run ledger for ACT-04. One row per daemon run, written service-role only and admin-readable through RLS.';
COMMENT ON COLUMN public.runner_runs.ticket_id IS
  'Ticket worked by this run. Nullable and ON DELETE SET NULL so ticket deletion never destroys operational history.';
COMMENT ON COLUMN public.runner_runs.status IS
  'Run lifecycle status such as started, awaiting_approval, gate_failed, requeued, escalated, merged, or failed.';
COMMENT ON COLUMN public.runner_runs.outcome IS
  'Terminal or latest outcome string emitted by the daemon, matching JSONL evidence semantics.';
COMMENT ON COLUMN public.runner_runs.duration_sec IS
  'Wall-clock duration in seconds from started_at to the latest finish/update timestamp.';
COMMENT ON COLUMN public.runner_runs.est_cost IS
  'Display/budget-use field only; not per-token billing and not a customer charge source.';
COMMENT ON COLUMN public.runner_runs.gate_verdict IS
  'Deterministic gate result summary, for example pass, fail, skipped, or null when not reached.';
COMMENT ON COLUMN public.runner_runs.gate_stage IS
  'Gate stage associated with gate_verdict, for example kill_switch, commit_advance, test_integrity, denylist, or verification.';
COMMENT ON COLUMN public.runner_runs.test_cmd IS
  'Verification command family run by the daemon, for example vitest+build.';
COMMENT ON COLUMN public.runner_runs.test_exit IS
  'Exit code for test_cmd; null when no test command ran.';
COMMENT ON COLUMN public.runner_runs.diff_stat IS
  'git diff --stat output for the prepared fix branch.';
COMMENT ON COLUMN public.runner_runs.branch IS
  'Held fix branch or operational branch name associated with the run.';
COMMENT ON COLUMN public.runner_runs.fix_sha IS
  'Prepared fix commit SHA, if one was created.';
COMMENT ON COLUMN public.runner_runs.detail IS
  'Structured operational detail JSON shared with JSONL evidence; admin-only because it may include internal paths/output.';
COMMENT ON POLICY "Admins can view runner runs" ON public.runner_runs IS
  'Runner run internals are admin-only (T-17-01). Service-role bypasses RLS for daemon insert/update.';
