-- Purpose: ticket 57aa5ca3 (weekly-council) — progressive canary verification.
-- The existing canary loop (phase19_autopilot_trust) is a single re-test at
-- postMergeDelayHours after merge: one pass marks the fix "passed" forever.
-- That's a single sample, not a consecutive-success/observation-window check,
-- and it has no way to introduce a new check in non-gating (dry-run) mode
-- before trusting it to reopen tickets. This migration adds the columns the
-- autopilot engine (sibling repo ~/dev/autopilot, src/lib/canary.ts) needs to
-- require N consecutive passes across an observation window before a fix is
-- considered survived, and to mark a canary run as dry-run (logged, non-gating)
-- while a new check is being validated. Additive only — every new column has
-- a default that preserves today's single-shot-pass behavior.

ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS canary_consecutive_passes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canary_required_passes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canary_dry_run boolean NOT NULL DEFAULT false;

ALTER TABLE public.runner_runs
  ADD CONSTRAINT runner_runs_canary_consecutive_passes_check
    CHECK (canary_consecutive_passes >= 0);

ALTER TABLE public.runner_runs
  ADD CONSTRAINT runner_runs_canary_required_passes_check
    CHECK (canary_required_passes >= 1);

COMMENT ON COLUMN public.runner_runs.canary_consecutive_passes IS
  'Ticket 57aa5ca3: count of consecutive passing canary re-tests since the last failure/reset. Reset to 0 on any failing re-test.';
COMMENT ON COLUMN public.runner_runs.canary_required_passes IS
  'Ticket 57aa5ca3: consecutive passes required (observation window) before canary_status flips to passed. Defaults to 1 to preserve prior single-shot behavior.';
COMMENT ON COLUMN public.runner_runs.canary_dry_run IS
  'Ticket 57aa5ca3: when true, a failing canary re-test is logged to canary_failure_detail but does not reopen the ticket or emit a trust event — for validating a new check before it gates.';
