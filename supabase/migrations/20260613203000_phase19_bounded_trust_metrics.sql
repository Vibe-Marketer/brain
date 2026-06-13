-- Migration: Phase 19 bounded trust metrics
-- Purpose: H-2 — remove quadratic runner_runs joins and bound canary aggregates to 30 days.
-- Date: 2026-06-13

CREATE OR REPLACE FUNCTION public.autopilot_trust_metrics()
RETURNS TABLE (
  category text,
  rung text,
  completed_fixes bigint,
  survived_fixes bigint,
  reopened_fixes bigint,
  deferred_runs bigint,
  survival_rate numeric,
  eligible boolean,
  canary_due_count bigint,
  canary_failed_count bigint,
  threshold numeric,
  min_fixes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    act.category,
    act.rung,
    act.completed_fixes_30d::bigint AS completed_fixes,
    act.survived_fixes_30d::bigint AS survived_fixes,
    act.reopened_fixes_30d::bigint AS reopened_fixes,
    act.deferred_runs_30d::bigint AS deferred_runs,
    act.survival_rate_30d AS survival_rate,
    (
      act.completed_fixes_30d >= act.min_fixes
      AND act.survival_rate_30d >= act.survival_threshold
    ) AS eligible,
    COALESCE(canaries.canary_due_count, 0)::bigint AS canary_due_count,
    COALESCE(canaries.canary_failed_count, 0)::bigint AS canary_failed_count,
    act.survival_threshold AS threshold,
    act.min_fixes
  FROM public.autopilot_category_trust act
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (
        WHERE rr.canary_status = 'pending'
          AND rr.canary_next_run_at <= now()
      )::bigint AS canary_due_count,
      COUNT(*) FILTER (
        WHERE rr.canary_status = 'failed'
      )::bigint AS canary_failed_count
    FROM public.runner_runs rr
    WHERE rr.fix_category = act.category
      AND COALESCE(rr.finished_at, rr.started_at) >= now() - interval '30 days'
  ) canaries ON true
  ORDER BY act.category;
END;
$function$;

COMMENT ON FUNCTION public.autopilot_trust_metrics() IS
  'Admin-only metrics RPC over persisted autopilot_category_trust state; canary counts use one bounded 30-day lateral aggregate per category.';
