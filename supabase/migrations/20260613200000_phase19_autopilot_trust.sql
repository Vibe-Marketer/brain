-- Migration: Phase 19 autopilot trust schema
-- Purpose: TRU-01/TRU-02/TRU-03 — durable fix survival, category trust
--          ladder state, canary attribution, and admin-only trust metrics.
-- Date: 2026-06-13

ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS fix_category text,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS survival_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS survival_status text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_event_id uuid,
  ADD COLUMN IF NOT EXISTS canary_status text,
  ADD COLUMN IF NOT EXISTS canary_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS canary_next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS canary_failure_detail jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_survival_status_check'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_survival_status_check
      CHECK (
        survival_status IS NULL
        OR survival_status IN ('pending', 'held', 'reopened', 'deferred', 'not_applicable')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_canary_status_check'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_canary_status_check
      CHECK (
        canary_status IS NULL
        OR canary_status IN ('pending', 'passed', 'failed', 'skipped')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runner_runs_reopened_event_id_fkey'
      AND conrelid = 'public.runner_runs'::regclass
  ) THEN
    ALTER TABLE public.runner_runs
      ADD CONSTRAINT runner_runs_reopened_event_id_fkey
      FOREIGN KEY (reopened_event_id)
      REFERENCES public.ticket_events(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.autopilot_category_trust (
  category text PRIMARY KEY,
  rung text NOT NULL DEFAULT 'manual',
  min_fixes integer NOT NULL DEFAULT 5,
  survival_threshold numeric(5, 4) NOT NULL DEFAULT 0.9000,
  completed_fixes_30d integer NOT NULL DEFAULT 0,
  survived_fixes_30d integer NOT NULL DEFAULT 0,
  reopened_fixes_30d integer NOT NULL DEFAULT 0,
  survival_rate_30d numeric(7, 4) NOT NULL DEFAULT 0,
  deferred_runs_30d integer NOT NULL DEFAULT 0,
  last_rollup_at timestamptz,
  last_promoted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_promoted_at timestamptz,
  last_demoted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_demoted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT autopilot_category_trust_rung_check
    CHECK (rung IN ('manual', 'eligible', 'auto')),
  CONSTRAINT autopilot_category_trust_min_fixes_check
    CHECK (min_fixes >= 1),
  CONSTRAINT autopilot_category_trust_survival_threshold_check
    CHECK (survival_threshold >= 0 AND survival_threshold <= 1),
  CONSTRAINT autopilot_category_trust_rollups_nonnegative_check
    CHECK (
      completed_fixes_30d >= 0
      AND survived_fixes_30d >= 0
      AND reopened_fixes_30d >= 0
      AND deferred_runs_30d >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.autopilot_trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.runner_runs(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  category text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autopilot_category_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopilot_trust_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view autopilot category trust" ON public.autopilot_category_trust;
CREATE POLICY "Admins can view autopilot category trust"
  ON public.autopilot_category_trust FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

DROP POLICY IF EXISTS "Admins can view autopilot trust events" ON public.autopilot_trust_events;
CREATE POLICY "Admins can view autopilot trust events"
  ON public.autopilot_trust_events FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

REVOKE INSERT, UPDATE, DELETE ON public.autopilot_category_trust FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.autopilot_trust_events FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_runner_runs_due_canaries
  ON public.runner_runs (canary_next_run_at, fix_category)
  WHERE canary_status = 'pending'
    AND canary_next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_runner_runs_category_survival_rollup
  ON public.runner_runs (fix_category, survival_due_at, survival_status)
  WHERE fix_category IS NOT NULL
    AND merged_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_autopilot_category_trust_rung
  ON public.autopilot_category_trust (rung, survival_rate_30d DESC);

CREATE INDEX IF NOT EXISTS idx_autopilot_trust_events_category_created_at
  ON public.autopilot_trust_events (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autopilot_trust_events_run_id
  ON public.autopilot_trust_events (run_id);

CREATE OR REPLACE FUNCTION public.rollup_autopilot_category_trust()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  WITH eligible_runs AS (
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
    COUNT(rr_due.id) FILTER (
      WHERE rr_due.canary_status = 'pending'
        AND rr_due.canary_next_run_at <= now()
    )::bigint AS canary_due_count,
    COUNT(rr_failed.id) FILTER (
      WHERE rr_failed.canary_status = 'failed'
    )::bigint AS canary_failed_count,
    act.survival_threshold AS threshold,
    act.min_fixes
  FROM public.autopilot_category_trust act
  LEFT JOIN public.runner_runs rr_due
    ON rr_due.fix_category = act.category
  LEFT JOIN public.runner_runs rr_failed
    ON rr_failed.fix_category = act.category
  GROUP BY
    act.category,
    act.rung,
    act.completed_fixes_30d,
    act.survived_fixes_30d,
    act.reopened_fixes_30d,
    act.deferred_runs_30d,
    act.survival_rate_30d,
    act.survival_threshold,
    act.min_fixes
  ORDER BY act.category;
END;
$function$;

REVOKE ALL ON FUNCTION public.rollup_autopilot_category_trust() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollup_autopilot_category_trust() TO authenticated;

REVOKE ALL ON FUNCTION public.autopilot_trust_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autopilot_trust_metrics() TO authenticated;

COMMENT ON COLUMN public.runner_runs.fix_category IS
  'D-02/TRU-01: category used for durable 30-day fix-survival rollups.';
COMMENT ON COLUMN public.runner_runs.survival_due_at IS
  'D-02/TRU-01: timestamp when a merged fix is mature enough to count in the 30-day survival denominator.';
COMMENT ON COLUMN public.runner_runs.survival_status IS
  'D-02/D-05: pending, held, reopened, deferred, or not_applicable. deferred:rate-limit rows are excluded from survival denominators.';
COMMENT ON COLUMN public.runner_runs.reopened_event_id IS
  'D-04/TRU-03: ticket_events link for canary or survival reopen attribution to the originating ticket/run.';
COMMENT ON COLUMN public.runner_runs.canary_next_run_at IS
  'D-04/TRU-03: next scheduled canary re-test for a recently merged fix.';
COMMENT ON TABLE public.autopilot_category_trust IS
  'D-02/D-03: durable category trust state and persisted 30-day survival rollups. auto rung requires an explicit audited admin event.';
COMMENT ON COLUMN public.autopilot_category_trust.rung IS
  'D-03: manual, eligible, or auto. auto is stored authority, not silently computed by autopilot_trust_metrics().';
COMMENT ON COLUMN public.autopilot_category_trust.deferred_runs_30d IS
  'D-05: rate-limit defers counted separately and excluded from completed_fixes_30d survival denominators.';
COMMENT ON TABLE public.autopilot_trust_events IS
  'D-03/D-04: append-only trust audit log for admin rung changes, canary outcomes, reopen attribution, and automatic demotion events.';
COMMENT ON FUNCTION public.rollup_autopilot_category_trust() IS
  'Persists category survival counters from matured merged runner_runs. Rate-limit defers are counted separately outside the survival denominator.';
COMMENT ON FUNCTION public.autopilot_trust_metrics() IS
  'Admin-only metrics RPC over persisted autopilot_category_trust state; does not silently promote categories to auto.';
