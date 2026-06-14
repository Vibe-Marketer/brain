-- Migration: Phase 22 ticket recurrence classes
-- Purpose: REC-01/REC-02 — persist recurring ticket classes from resolved
--          ticket history, create one structural-fix task per recurring class,
--          and track before/after recurrence rates for admin observability.
-- Date: 2026-06-14

CREATE OR REPLACE FUNCTION public.normalize_ticket_class_part(
  p_input text,
  p_fallback text DEFAULT 'unknown'
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(lower(trim(COALESCE(p_input, p_fallback))), '[^a-z0-9_:-]+', '_', 'g'),
        '^_+|_+$',
        '',
        'g'
      ),
      ''
    ),
    p_fallback
  );
$function$;

CREATE OR REPLACE FUNCTION public.ticket_error_class(p_context jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT public.normalize_ticket_class_part(
    COALESCE(
      p_context->>'error_class',
      p_context->>'errorClass',
      p_context->>'error_type',
      p_context->>'exception_type',
      p_context #>> '{sentry,error_class}',
      p_context #>> '{sentry,exception_type}',
      p_context #>> '{sentry,type}',
      p_context->>'finding_type',
      p_context->>'category'
    ),
    'unknown'
  );
$function$;

CREATE OR REPLACE FUNCTION public.ticket_fingerprint_root(
  p_fingerprint text,
  p_context jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT public.normalize_ticket_class_part(
    COALESCE(
      p_context->>'fingerprint_root',
      p_context->>'fingerprintRoot',
      p_context #>> '{sentry,fingerprint_root}',
      p_context #>> '{qa,fingerprint_root}',
      CASE
        WHEN p_fingerprint IS NULL THEN NULL
        ELSE regexp_replace(p_fingerprint, ':[0-9a-f]{8,}.*$', '', 'i')
      END
    ),
    'unknown'
  );
$function$;

CREATE OR REPLACE FUNCTION public.ticket_class_key(
  p_source public.ticket_source,
  p_context jsonb,
  p_fingerprint text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT
    'source:' || public.normalize_ticket_class_part(p_source::text, 'unknown')
    || ':error:' || public.ticket_error_class(COALESCE(p_context, '{}'::jsonb))
    || ':fingerprint:' || public.normalize_ticket_class_part(p_source::text, 'unknown') || ':' || public.ticket_fingerprint_root(p_fingerprint, COALESCE(p_context, '{}'::jsonb));
$function$;

CREATE TABLE IF NOT EXISTS public.ticket_classes (
  class_key text PRIMARY KEY,
  source public.ticket_source NOT NULL,
  error_class text NOT NULL,
  fingerprint_root text NOT NULL,
  threshold_count integer NOT NULL DEFAULT 3,
  threshold_window_days integer NOT NULL DEFAULT 30,
  killed_threshold_rate numeric(9, 4) NOT NULL DEFAULT 0.0100,
  resolved_count_30d integer NOT NULL DEFAULT 0,
  occurrence_count_30d integer NOT NULL DEFAULT 0,
  fresh_ticket_rate_30d numeric(9, 4) NOT NULL DEFAULT 0,
  baseline_rate_30d numeric(9, 4),
  post_fix_rate_30d numeric(9, 4),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  first_threshold_at timestamptz,
  structural_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  structural_fix_landed_at timestamptz,
  killed_at timestamptz,
  status text NOT NULL DEFAULT 'watching',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_rollup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_classes_threshold_count_check CHECK (threshold_count >= 3),
  CONSTRAINT ticket_classes_threshold_window_days_check CHECK (threshold_window_days >= 1),
  CONSTRAINT ticket_classes_counts_nonnegative_check CHECK (
    resolved_count_30d >= 0
    AND occurrence_count_30d >= 0
    AND fresh_ticket_rate_30d >= 0
    AND COALESCE(baseline_rate_30d, 0) >= 0
    AND COALESCE(post_fix_rate_30d, 0) >= 0
  ),
  CONSTRAINT ticket_classes_status_check CHECK (
    status IN ('watching', 'recurring', 'structural_fix_queued', 'landed', 'killed')
  )
);

ALTER TABLE public.ticket_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ticket classes" ON public.ticket_classes;
CREATE POLICY "Admins can read ticket classes"
  ON public.ticket_classes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

REVOKE INSERT, UPDATE, DELETE ON public.ticket_classes FROM anon, authenticated;
GRANT SELECT ON public.ticket_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_classes TO service_role;

CREATE INDEX IF NOT EXISTS idx_ticket_classes_status
  ON public.ticket_classes(status, fresh_ticket_rate_30d DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_classes_structural_ticket_id
  ON public.ticket_classes(structural_ticket_id)
  WHERE structural_ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_classes_source_error
  ON public.ticket_classes(source, error_class);

CREATE OR REPLACE FUNCTION public.rollup_ticket_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  WITH resolved_tickets AS (
    SELECT
      t.id,
      t.source,
      public.ticket_error_class(t.context) AS error_class,
      public.normalize_ticket_class_part(t.source::text, 'unknown') || ':' || public.ticket_fingerprint_root(t.fingerprint, t.context) AS fingerprint_root,
      public.ticket_class_key(t.source, t.context, t.fingerprint) AS class_key,
      GREATEST(COALESCE(t.occurrence_count, 1), 1) AS occurrence_count,
      t.created_at,
      t.last_seen_at
    FROM public.tickets t
    WHERE t.status = 'resolved'
      AND t.fingerprint IS NOT NULL
      AND t.created_at >= now() - interval '30 days'
  ),
  rollups AS (
    SELECT
      rt.class_key,
      MIN(rt.source) AS source,
      MIN(rt.error_class) AS error_class,
      MIN(rt.fingerprint_root) AS fingerprint_root,
      COUNT(*)::integer AS resolved_count_30d,
      SUM(rt.occurrence_count)::integer AS occurrence_count_30d,
      ROUND((SUM(rt.occurrence_count)::numeric / 30::numeric), 4) AS fresh_ticket_rate_30d,
      MIN(rt.created_at) AS first_seen_at,
      MAX(COALESCE(rt.last_seen_at, rt.created_at)) AS last_seen_at
    FROM resolved_tickets rt
    GROUP BY rt.class_key
  ),
  upserted AS (
    INSERT INTO public.ticket_classes (
      class_key,
      source,
      error_class,
      fingerprint_root,
      resolved_count_30d,
      occurrence_count_30d,
      fresh_ticket_rate_30d,
      baseline_rate_30d,
      first_seen_at,
      last_seen_at,
      first_threshold_at,
      status,
      context,
      last_rollup_at,
      updated_at
    )
    SELECT
      r.class_key,
      r.source,
      r.error_class,
      r.fingerprint_root,
      r.resolved_count_30d,
      r.occurrence_count_30d,
      r.fresh_ticket_rate_30d,
      CASE WHEN r.occurrence_count_30d >= 3 THEN r.fresh_ticket_rate_30d ELSE NULL END,
      r.first_seen_at,
      r.last_seen_at,
      CASE WHEN r.occurrence_count_30d >= 3 THEN now() ELSE NULL END,
      CASE WHEN r.occurrence_count_30d >= 3 THEN 'recurring' ELSE 'watching' END,
      jsonb_build_object(
        'class_root', r.class_key,
        'source', r.source::text,
        'error_class', r.error_class,
        'fingerprint_root', r.fingerprint_root,
        'threshold_count', 3,
        'threshold_window_days', 30
      ),
      now(),
      now()
    FROM rollups r
    ON CONFLICT (class_key) DO UPDATE SET
      source = EXCLUDED.source,
      error_class = EXCLUDED.error_class,
      fingerprint_root = EXCLUDED.fingerprint_root,
      resolved_count_30d = EXCLUDED.resolved_count_30d,
      occurrence_count_30d = EXCLUDED.occurrence_count_30d,
      fresh_ticket_rate_30d = EXCLUDED.fresh_ticket_rate_30d,
      baseline_rate_30d = CASE
        WHEN public.ticket_classes.structural_fix_landed_at IS NOT NULL THEN public.ticket_classes.baseline_rate_30d
        WHEN public.ticket_classes.baseline_rate_30d IS NOT NULL THEN public.ticket_classes.baseline_rate_30d
        WHEN EXCLUDED.occurrence_count_30d >= public.ticket_classes.threshold_count THEN EXCLUDED.fresh_ticket_rate_30d
        ELSE NULL
      END,
      post_fix_rate_30d = CASE
        WHEN public.ticket_classes.structural_fix_landed_at IS NOT NULL
          THEN EXCLUDED.fresh_ticket_rate_30d
        ELSE public.ticket_classes.post_fix_rate_30d
      END,
      first_seen_at = LEAST(COALESCE(public.ticket_classes.first_seen_at, EXCLUDED.first_seen_at), EXCLUDED.first_seen_at),
      last_seen_at = EXCLUDED.last_seen_at,
      first_threshold_at = CASE
        WHEN public.ticket_classes.first_threshold_at IS NOT NULL THEN public.ticket_classes.first_threshold_at
        WHEN EXCLUDED.occurrence_count_30d >= public.ticket_classes.threshold_count THEN now()
        ELSE NULL
      END,
      status = CASE
        WHEN public.ticket_classes.killed_at IS NOT NULL THEN 'killed'
        WHEN public.ticket_classes.structural_fix_landed_at IS NOT NULL THEN 'landed'
        WHEN public.ticket_classes.structural_ticket_id IS NOT NULL THEN 'structural_fix_queued'
        WHEN EXCLUDED.occurrence_count_30d >= public.ticket_classes.threshold_count THEN 'recurring'
        ELSE 'watching'
      END,
      context = public.ticket_classes.context || EXCLUDED.context,
      last_rollup_at = now(),
      updated_at = now()
    RETURNING
      public.ticket_classes.class_key,
      public.ticket_classes.source,
      public.ticket_classes.error_class,
      public.ticket_classes.fingerprint_root,
      public.ticket_classes.resolved_count_30d,
      public.ticket_classes.occurrence_count_30d,
      public.ticket_classes.fresh_ticket_rate_30d,
      public.ticket_classes.baseline_rate_30d,
      public.ticket_classes.threshold_count,
      public.ticket_classes.threshold_window_days,
      public.ticket_classes.structural_ticket_id,
      public.ticket_classes.status
  ),
  task_candidates AS (
    SELECT u.*
    FROM upserted u
    WHERE u.occurrence_count_30d >= u.threshold_count
      AND u.structural_ticket_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.tickets open_structural
        WHERE open_structural.type = 'task'
          AND open_structural.source = 'internal'
          AND open_structural.status IN ('new', 'in_progress', 'awaiting_approval', 'escalated')
          AND open_structural.context->>'ticket_class_key' = u.class_key
      )
  ),
  inserted_tasks AS (
    INSERT INTO public.tickets (
      reporter_id,
      type,
      severity,
      status,
      source,
      fingerprint,
      context,
      occurrence_count,
      last_seen_at
    )
    SELECT
      NULL,
      'task',
      'medium',
      'escalated',
      'internal',
      'ticket-class:' || tc.class_key,
      jsonb_build_object(
        'ticket_class_key', tc.class_key,
        'class_root', tc.class_key,
        'source', tc.source::text,
        'error_class', tc.error_class,
        'fingerprint_root', tc.fingerprint_root,
        'resolved_count_30d', tc.resolved_count_30d,
        'occurrence_count_30d', tc.occurrence_count_30d,
        'baseline_rate_30d', tc.baseline_rate_30d,
        'fresh_ticket_rate_30d', tc.fresh_ticket_rate_30d,
        'recurrence_action', 'tier2_digest_queued',
        'tier', 'tier-2',
        'approval_required', true,
        'options_required', true
      ),
      1,
      now()
    FROM task_candidates tc
    RETURNING id, context->>'ticket_class_key' AS class_key
  ),
  linked_tasks AS (
    UPDATE public.ticket_classes tc
    SET
      structural_ticket_id = it.id,
      status = 'structural_fix_queued',
      context = tc.context || jsonb_build_object(
        'structural_ticket_id', it.id,
        'recurrence_action', 'tier2_digest_queued'
      ),
      updated_at = now()
    FROM inserted_tasks it
    WHERE tc.class_key = it.class_key
    RETURNING tc.class_key, it.id
  ),
  task_events AS (
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    SELECT lt.id, NULL, 'created', 'escalated'
    FROM linked_tasks lt
    RETURNING ticket_id
  ),
  landed AS (
    UPDATE public.ticket_classes tc
    SET
      structural_fix_landed_at = COALESCE(tc.structural_fix_landed_at, now()),
      baseline_rate_30d = COALESCE(tc.baseline_rate_30d, tc.fresh_ticket_rate_30d),
      status = CASE WHEN tc.killed_at IS NOT NULL THEN 'killed' ELSE 'landed' END,
      context = tc.context || jsonb_build_object('structural_fix_landed_signal', 'verified-stable-or-resolved'),
      updated_at = now()
    FROM public.tickets linked_task
    WHERE linked_task.id = tc.structural_ticket_id
      AND tc.structural_fix_landed_at IS NULL
      AND (
        COALESCE(linked_task.status::text, '') = 'resolved'
        OR linked_task.context::text ILIKE '%verified-stable%'
        OR EXISTS (
          SELECT 1
          FROM public.ticket_events landed_event
          WHERE landed_event.ticket_id = linked_task.id
            AND (
              landed_event.event_type IN ('verified_stable_deploy', 'deploy_verified_stable')
              OR landed_event.new_value ILIKE '%verified-stable%'
            )
        )
      )
    RETURNING tc.class_key
  ),
  post_landing_rates AS (
    SELECT
      tc.class_key,
      ROUND((COALESCE(SUM(GREATEST(COALESCE(t.occurrence_count, 1), 1)), 0)::numeric / 30::numeric), 4) AS post_rate
    FROM public.ticket_classes tc
    LEFT JOIN public.tickets t
      ON public.ticket_class_key(t.source, t.context, t.fingerprint) = tc.class_key
      AND t.status = 'resolved'
      AND t.created_at >= tc.structural_fix_landed_at
      AND t.created_at >= now() - interval '30 days'
    WHERE tc.structural_fix_landed_at IS NOT NULL
    GROUP BY tc.class_key
  ),
  updated AS (
    UPDATE public.ticket_classes tc
    SET
      post_fix_rate_30d = CASE
        WHEN tc.structural_fix_landed_at IS NOT NULL
          THEN plr.post_rate
        ELSE tc.post_fix_rate_30d
      END,
      updated_at = now()
    FROM post_landing_rates plr
    WHERE tc.class_key = plr.class_key
    RETURNING
      tc.class_key,
      tc.structural_fix_landed_at,
      tc.post_fix_rate_30d,
      tc.killed_threshold_rate,
      tc.killed_at
  )
  UPDATE public.ticket_classes tc
  SET
    killed_at = COALESCE(updated.killed_at, now()),
    status = 'killed',
    updated_at = now()
  FROM updated
  WHERE tc.class_key = updated.class_key
    AND updated.structural_fix_landed_at IS NOT NULL
    AND updated.post_fix_rate_30d < updated.killed_threshold_rate
    AND tc.killed_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ticket_class_metrics()
RETURNS TABLE (
  class_key text,
  source public.ticket_source,
  error_class text,
  fingerprint_root text,
  status text,
  resolved_count_30d integer,
  occurrence_count_30d integer,
  fresh_ticket_rate_30d numeric,
  baseline_rate_30d numeric,
  post_fix_rate_30d numeric,
  structural_ticket_id uuid,
  structural_fix_landed_at timestamptz,
  killed_at timestamptz,
  context jsonb
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
    tc.class_key,
    tc.source,
    tc.error_class,
    tc.fingerprint_root,
    tc.status,
    tc.resolved_count_30d,
    tc.occurrence_count_30d,
    tc.fresh_ticket_rate_30d,
    tc.baseline_rate_30d,
    tc.post_fix_rate_30d,
    tc.structural_ticket_id,
    tc.structural_fix_landed_at,
    tc.killed_at,
    tc.context
  FROM public.ticket_classes tc
  ORDER BY tc.fresh_ticket_rate_30d DESC, tc.occurrence_count_30d DESC, tc.class_key;
END;
$function$;

REVOKE ALL ON FUNCTION public.rollup_ticket_classes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_ticket_classes() TO service_role;

REVOKE ALL ON FUNCTION public.ticket_class_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_class_metrics() TO authenticated;

COMMENT ON TABLE public.ticket_classes IS
  'REC-01/REC-02: durable recurring ticket class state over resolved ticket history, including structural-fix task linkage and before/after recurrence rates.';
COMMENT ON FUNCTION public.rollup_ticket_classes() IS
  'Service-role-only recurrence rollup. Clusters resolved tickets by source/error/source-namespaced fingerprint root, creates one tier-2 structural task, and updates landed/post-fix/killed lifecycle state.';
COMMENT ON FUNCTION public.ticket_class_metrics() IS
  'Admin-only metrics RPC for recurring ticket classes and structural-fix recurrence rates.';
