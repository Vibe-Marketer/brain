-- Migration: Sentry debounce, resolve cycle-time metrics, and fingerprint cap
-- Purpose: SEN-04 + SEN-05 — add the DB-owned guards that make Sentry
--          auto-debug/fix/resolve safe: a tunable debounce predicate, a
--          sentry_resolved_at write-back timestamp plus resolve-ASAP tracking
--          surface, and durable per-fingerprint autonomous fix-attempt cap
--          state. This migration is additive only; ingest_sentry_ticket and
--          the fingerprint unique index remain untouched.
-- Author: Phase 21 Plan 01 (sentry-debug-fix-resolve)
-- Date: 2026-06-13

-- ============================================================================
-- TABLE ALTERATIONS: tickets
-- ============================================================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS sentry_resolved_at TIMESTAMPTZ;

-- ============================================================================
-- TABLE: sentry_fingerprint_cap
-- ============================================================================
-- Service-role-only system state. No user columns are present by design:
-- this freezes one Sentry fingerprint/category, never the whole autopilot loop.
CREATE TABLE IF NOT EXISTS public.sentry_fingerprint_cap (
  fingerprint TEXT PRIMARY KEY,
  fix_attempts INTEGER NOT NULL DEFAULT 0,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  CONSTRAINT sentry_fingerprint_cap_fix_attempts_nonnegative
    CHECK (fix_attempts >= 0),
  CONSTRAINT sentry_fingerprint_cap_cap_state_consistent
    CHECK ((frozen = FALSE AND frozen_at IS NULL) OR frozen = TRUE)
);

ALTER TABLE public.sentry_fingerprint_cap ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sentry_fingerprint_cap_frozen
  ON public.sentry_fingerprint_cap (frozen, last_attempt_at DESC);

-- ============================================================================
-- FUNCTION: record_fingerprint_fix_attempt
-- ============================================================================
-- Records only real autonomous Sentry fix lifecycle events: attempted/merged
-- fixes and real regression detections. Bare sentry-resolve API 4xx/5xx
-- write-back failures must not call this RPC because they are not fix
-- regressions.
CREATE OR REPLACE FUNCTION public.record_fingerprint_fix_attempt(
  p_fingerprint TEXT,
  p_cap INTEGER DEFAULT 3
)
RETURNS TABLE (
  fingerprint TEXT,
  fix_attempts INTEGER,
  frozen BOOLEAN,
  newly_frozen BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_existing public.sentry_fingerprint_cap%ROWTYPE;
  v_attempts INTEGER;
  v_frozen BOOLEAN;
  v_newly_frozen BOOLEAN;
BEGIN
  IF p_fingerprint IS NULL OR btrim(p_fingerprint) = '' THEN
    RAISE EXCEPTION 'p_fingerprint is required';
  END IF;

  IF p_cap IS NULL OR p_cap < 1 THEN
    RAISE EXCEPTION 'p_cap must be >= 1';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.sentry_fingerprint_cap sfc
  WHERE sfc.fingerprint = p_fingerprint
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.sentry_fingerprint_cap (
      fingerprint,
      fix_attempts,
      frozen,
      frozen_at,
      last_attempt_at
    )
    VALUES (
      p_fingerprint,
      1,
      FALSE,
      NULL,
      NOW()
    )
    RETURNING sentry_fingerprint_cap.fix_attempts, sentry_fingerprint_cap.frozen
    INTO v_attempts, v_frozen;

    RETURN QUERY SELECT p_fingerprint, v_attempts, v_frozen, FALSE;
    RETURN;
  END IF;

  IF v_existing.frozen THEN
    UPDATE public.sentry_fingerprint_cap sfc
    SET last_attempt_at = NOW()
    WHERE sfc.fingerprint = p_fingerprint
    RETURNING sfc.fix_attempts, sfc.frozen
    INTO v_attempts, v_frozen;

    RETURN QUERY SELECT p_fingerprint, v_attempts, v_frozen, FALSE;
    RETURN;
  END IF;

  v_attempts := v_existing.fix_attempts + 1;
  v_frozen := v_attempts > p_cap;
  v_newly_frozen := v_frozen;

  UPDATE public.sentry_fingerprint_cap sfc
  SET
    fix_attempts = v_attempts,
    frozen = v_frozen,
    frozen_at = CASE WHEN v_frozen THEN COALESCE(sfc.frozen_at, NOW()) ELSE sfc.frozen_at END,
    last_attempt_at = NOW()
  WHERE sfc.fingerprint = p_fingerprint;

  RETURN QUERY SELECT p_fingerprint, v_attempts, v_frozen, v_newly_frozen;
END;
$function$;

-- ============================================================================
-- FUNCTION: sentry_ticket_fixable
-- ============================================================================
-- Debounce applies only to Sentry tickets. Non-Sentry tickets remain claimable
-- by existing queue rules.
CREATE OR REPLACE FUNCTION public.sentry_ticket_fixable(
  p_ticket_id UUID,
  p_min_occurrences INTEGER DEFAULT 3,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ticket RECORD;
BEGIN
  IF p_min_occurrences IS NULL OR p_min_occurrences < 1 THEN
    RAISE EXCEPTION 'p_min_occurrences must be >= 1';
  END IF;

  IF p_window_minutes IS NULL OR p_window_minutes < 1 THEN
    RAISE EXCEPTION 'p_window_minutes must be >= 1';
  END IF;

  SELECT source, occurrence_count, created_at, last_seen_at
  INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_ticket.source <> 'sentry' THEN
    RETURN TRUE;
  END IF;

  RETURN v_ticket.occurrence_count >= p_min_occurrences
    AND v_ticket.last_seen_at >= v_ticket.created_at
    AND v_ticket.last_seen_at <= v_ticket.created_at
      + make_interval(mins => p_window_minutes);
END;
$function$;

-- ============================================================================
-- FUNCTION: sentry_resolve_cycle_time_metrics
-- ============================================================================
-- Service-role tracking surface for resolve-ASAP. Cycle time is measured from
-- ticket creation (error/ticket first seen) to the Sentry write-back timestamp.
-- fix_at is the latest successful/merged runner run timestamp for the ticket.
CREATE OR REPLACE FUNCTION public.sentry_resolve_cycle_time_metrics(
  p_target_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  ticket_id UUID,
  fingerprint TEXT,
  error_at TIMESTAMPTZ,
  ticket_created_at TIMESTAMPTZ,
  fix_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cycle_time_seconds INTEGER,
  resolve_asap_target_minutes INTEGER,
  resolve_asap_met BOOLEAN,
  resolve_asap_status TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $function$
  WITH latest_successful_run AS (
    SELECT DISTINCT ON (rr.ticket_id)
      rr.ticket_id,
      COALESCE(rr.merged_at, rr.finished_at, rr.started_at) AS fix_at
    FROM public.runner_runs rr
    WHERE rr.ticket_id IS NOT NULL
      AND (
        rr.merged_at IS NOT NULL
        OR rr.status = 'merged'
        OR rr.outcome IN ('fixed', 'merged', 'resolved')
        OR rr.gate_verdict = 'pass'
      )
    ORDER BY rr.ticket_id, COALESCE(rr.merged_at, rr.finished_at, rr.started_at) DESC
  )
  SELECT
    t.id AS ticket_id,
    t.fingerprint,
    t.created_at AS error_at,
    t.created_at AS ticket_created_at,
    lsr.fix_at,
    t.sentry_resolved_at AS resolved_at,
    CASE
      WHEN t.sentry_resolved_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (t.sentry_resolved_at - t.created_at))::INTEGER
    END AS cycle_time_seconds,
    p_target_minutes AS resolve_asap_target_minutes,
    CASE
      WHEN t.sentry_resolved_at IS NULL THEN NULL
      ELSE t.sentry_resolved_at <= t.created_at + make_interval(mins => p_target_minutes)
    END AS resolve_asap_met,
    CASE
      WHEN t.sentry_resolved_at IS NULL AND lsr.fix_at IS NULL THEN 'pending_fix'
      WHEN t.sentry_resolved_at IS NULL THEN 'pending_resolve'
      WHEN t.sentry_resolved_at <= t.created_at + make_interval(mins => p_target_minutes) THEN 'met'
      ELSE 'missed'
    END AS resolve_asap_status
  FROM public.tickets t
  LEFT JOIN latest_successful_run lsr ON lsr.ticket_id = t.id
  WHERE t.source = 'sentry';
$function$;

-- ============================================================================
-- PRIVILEGES
-- ============================================================================
-- Service-role-only entry points. Postgres grants EXECUTE to PUBLIC by default
-- on new functions — revoke it, then grant service_role explicitly.
REVOKE ALL ON TABLE public.sentry_fingerprint_cap FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sentry_fingerprint_cap TO service_role;

REVOKE ALL ON FUNCTION public.record_fingerprint_fix_attempt(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_fingerprint_fix_attempt(TEXT, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.sentry_ticket_fixable(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sentry_ticket_fixable(UUID, INTEGER, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.sentry_resolve_cycle_time_metrics(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sentry_resolve_cycle_time_metrics(INTEGER)
  TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN public.tickets.sentry_resolved_at IS
  'Timestamp when the sentry-resolve write-back successfully marked the upstream Sentry issue resolved. NULL until the verified-stable resolve path stamps it.';
COMMENT ON TABLE public.sentry_fingerprint_cap IS
  'Service-role-only Sentry autonomous fix cap state. One row per Sentry fingerprint; freezes only that fingerprint/category after the configured cap is exceeded.';
COMMENT ON COLUMN public.sentry_fingerprint_cap.fingerprint IS
  'Sentry fingerprint key, matching tickets.fingerprint (for example sentry:<issue_id>).';
COMMENT ON COLUMN public.sentry_fingerprint_cap.fix_attempts IS
  'Count of real autonomous fix attempts or real regression detections for this fingerprint. Sentry resolve API write-back failures are not counted here.';
COMMENT ON COLUMN public.sentry_fingerprint_cap.frozen IS
  'When true, this fingerprint/category is excluded from autonomous claiming and should be escalated through the tier-2 solution path.';
COMMENT ON COLUMN public.sentry_fingerprint_cap.frozen_at IS
  'First timestamp when this fingerprint crossed the autonomous fix cap.';
COMMENT ON COLUMN public.sentry_fingerprint_cap.last_attempt_at IS
  'Most recent real autonomous fix attempt or real regression detection timestamp.';
COMMENT ON FUNCTION public.record_fingerprint_fix_attempt(TEXT, INTEGER) IS
  'Records a real autonomous Sentry fix attempt/regression for one fingerprint and freezes that fingerprint when the post-increment count exceeds p_cap. Returns newly_frozen only on the single false-to-true transition.';
COMMENT ON FUNCTION public.sentry_ticket_fixable(UUID, INTEGER, INTEGER) IS
  'Debounce predicate for Sentry tickets: TRUE only when source is not sentry, or the Sentry fingerprint reached the minimum occurrence count within the configured first-seen window.';
COMMENT ON FUNCTION public.sentry_resolve_cycle_time_metrics(INTEGER) IS
  'Service-role-only SEN-04 resolve-ASAP tracking surface for Sentry tickets, including latest successful fix timestamp, Sentry resolved timestamp, cycle time, target minutes, and met/missed/pending status.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
