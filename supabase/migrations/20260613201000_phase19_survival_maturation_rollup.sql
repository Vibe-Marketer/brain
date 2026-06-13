-- Migration: Phase 19 survival maturation rollup
-- Purpose: M-1 — mature pending 30-day survivors to held before category trust rollup counts them.
-- Date: 2026-06-13

CREATE OR REPLACE FUNCTION public.rollup_autopilot_category_trust()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  WITH matured_runs AS (
    UPDATE public.runner_runs rr
    SET survival_status = 'held'
    WHERE rr.fix_category IS NOT NULL
      AND rr.ticket_id IS NOT NULL
      AND rr.merged_at IS NOT NULL
      AND rr.survival_due_at IS NOT NULL
      AND rr.survival_due_at <= now()
      AND rr.survival_status = 'pending'
      AND NOT EXISTS (
        SELECT 1
        FROM public.ticket_events te
        WHERE te.ticket_id = rr.ticket_id
          AND te.created_at >= COALESCE(rr.merged_at, rr.finished_at, rr.started_at)
          AND te.created_at <= now()
          AND (
            te.event_type = 'canary_regression_reopened'
            OR (te.event_type = 'status_change' AND te.new_value = 'reopened')
          )
      )
    RETURNING rr.id
  ),
  eligible_runs AS (
    SELECT
      rr.id,
      rr.ticket_id,
      rr.fix_category AS category,
      rr.survival_status,
      rr.survival_due_at,
      EXISTS (
        SELECT 1
        FROM public.ticket_events te
        WHERE te.ticket_id = rr.ticket_id
          AND te.event_type = 'status_change'
          AND te.new_value = 'reopened'
          AND te.created_at >= COALESCE(rr.merged_at, rr.finished_at, rr.started_at)
          AND te.created_at <= COALESCE(rr.survival_due_at, now())
      ) AS has_reopen_event
    FROM public.runner_runs rr
    WHERE rr.fix_category IS NOT NULL
      AND rr.merged_at IS NOT NULL
      AND rr.survival_due_at IS NOT NULL
      AND rr.survival_due_at <= now()
      AND rr.survival_due_at >= now() - interval '30 days'
      AND COALESCE(rr.detail->>'defer_reason', '') <> 'rate-limit'
      AND COALESCE(rr.detail->>'rate_limit_suspected', 'false') <> 'true'
      AND COALESCE(rr.outcome, '') <> 'deferred:rate-limit'
      AND COALESCE(rr.status, '') <> 'deferred:rate-limit'
      AND COALESCE(rr.survival_status, '') <> 'deferred'
  ),
  rollups AS (
    SELECT
      er.category,
      COUNT(*) FILTER (
        WHERE er.survival_status IN ('held', 'reopened')
           OR er.has_reopen_event
      )::integer AS completed_fixes_30d,
      COUNT(*) FILTER (
        WHERE er.survival_status = 'held'
          AND NOT er.has_reopen_event
      )::integer AS survived_fixes_30d,
      COUNT(*) FILTER (
        WHERE er.survival_status = 'reopened'
           OR er.has_reopen_event
      )::integer AS reopened_fixes_30d
    FROM eligible_runs er
    GROUP BY er.category
  ),
  deferred AS (
    SELECT
      rr.fix_category AS category,
      COUNT(*)::integer AS deferred_runs_30d
    FROM public.runner_runs rr
    WHERE rr.fix_category IS NOT NULL
      AND COALESCE(rr.finished_at, rr.started_at) >= now() - interval '30 days'
      AND (
        rr.survival_status = 'deferred'
        OR rr.outcome = 'deferred:rate-limit'
        OR rr.status = 'deferred:rate-limit'
        OR rr.detail->>'defer_reason' = 'rate-limit'
        OR rr.detail->>'rate_limit_suspected' = 'true'
      )
    GROUP BY rr.fix_category
  ),
  categories AS (
    SELECT category FROM public.autopilot_category_trust
    UNION
    SELECT category FROM rollups
    UNION
    SELECT category FROM deferred
  ),
  upserted AS (
    INSERT INTO public.autopilot_category_trust (
      category,
      rung,
      completed_fixes_30d,
      survived_fixes_30d,
      reopened_fixes_30d,
      survival_rate_30d,
      deferred_runs_30d,
      last_rollup_at,
      updated_at
    )
    SELECT
      c.category,
      CASE
        WHEN existing.rung = 'auto' THEN 'auto'
        WHEN COALESCE(r.completed_fixes_30d, 0) >= COALESCE(existing.min_fixes, 5)
          AND (
            CASE
              WHEN COALESCE(r.completed_fixes_30d, 0) = 0 THEN 0::numeric
              ELSE ROUND(
                COALESCE(r.survived_fixes_30d, 0)::numeric
                / r.completed_fixes_30d::numeric,
                4
              )
            END
          ) >= COALESCE(existing.survival_threshold, 0.9000)
          THEN 'eligible'
        ELSE 'manual'
      END AS rung,
      COALESCE(r.completed_fixes_30d, 0),
      COALESCE(r.survived_fixes_30d, 0),
      COALESCE(r.reopened_fixes_30d, 0),
      CASE
        WHEN COALESCE(r.completed_fixes_30d, 0) = 0 THEN 0::numeric
        ELSE ROUND(COALESCE(r.survived_fixes_30d, 0)::numeric / r.completed_fixes_30d::numeric, 4)
      END AS survival_rate_30d,
      COALESCE(d.deferred_runs_30d, 0),
      now(),
      now()
    FROM categories c
    LEFT JOIN rollups r ON r.category = c.category
    LEFT JOIN deferred d ON d.category = c.category
    LEFT JOIN public.autopilot_category_trust existing ON existing.category = c.category
    ON CONFLICT (category) DO UPDATE SET
      completed_fixes_30d = EXCLUDED.completed_fixes_30d,
      survived_fixes_30d = EXCLUDED.survived_fixes_30d,
      reopened_fixes_30d = EXCLUDED.reopened_fixes_30d,
      survival_rate_30d = EXCLUDED.survival_rate_30d,
      deferred_runs_30d = EXCLUDED.deferred_runs_30d,
      last_rollup_at = EXCLUDED.last_rollup_at,
      rung = CASE
        WHEN public.autopilot_category_trust.rung = 'auto'
          AND (
            EXCLUDED.completed_fixes_30d < public.autopilot_category_trust.min_fixes
            OR EXCLUDED.survival_rate_30d < public.autopilot_category_trust.survival_threshold
          )
          THEN 'manual'
        WHEN public.autopilot_category_trust.rung = 'auto' THEN 'auto'
        ELSE EXCLUDED.rung
      END,
      last_demoted_at = CASE
        WHEN public.autopilot_category_trust.rung = 'auto'
          AND (
            EXCLUDED.completed_fixes_30d < public.autopilot_category_trust.min_fixes
            OR EXCLUDED.survival_rate_30d < public.autopilot_category_trust.survival_threshold
          )
          THEN now()
        ELSE public.autopilot_category_trust.last_demoted_at
      END,
      updated_at = now()
    RETURNING
      public.autopilot_category_trust.category,
      public.autopilot_category_trust.rung,
      public.autopilot_category_trust.completed_fixes_30d,
      public.autopilot_category_trust.survival_rate_30d
  )
  INSERT INTO public.autopilot_trust_events (
    category,
    event_type,
    old_value,
    new_value,
    metadata
  )
  SELECT
    u.category,
    'auto_demoted',
    'auto',
    u.rung,
    jsonb_build_object(
      'reason', 'survival_gate_failed',
      'completed_fixes_30d', u.completed_fixes_30d,
      'survival_rate_30d', u.survival_rate_30d
    )
  FROM upserted u
  WHERE u.rung = 'manual'
    AND EXISTS (
      SELECT 1
      FROM public.autopilot_trust_events e
      WHERE e.category = u.category
        AND e.event_type IN ('admin_promoted', 'admin_set_rung')
        AND e.new_value = 'auto'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.autopilot_trust_events e
      WHERE e.category = u.category
        AND e.event_type = 'auto_demoted'
        AND e.created_at >= now() - interval '1 minute'
    );
END;
$function$;

COMMENT ON FUNCTION public.rollup_autopilot_category_trust() IS
  'Persists category survival counters from matured merged runner_runs. Pending rows mature to held after survival_due_at when no reopen event exists.';
