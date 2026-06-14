-- Phase 22 review fix: replace rollup_ticket_classes() without editing the
-- already-applied 20260614010000_phase22_ticket_classes.sql migration.

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
      rt.source,
      rt.error_class,
      rt.fingerprint_root,
      3::integer AS threshold_count,
      30::integer AS threshold_window_days,
      COUNT(*)::integer AS resolved_count_30d,
      SUM(rt.occurrence_count)::integer AS occurrence_count_30d,
      ROUND((SUM(rt.occurrence_count)::numeric / 30::numeric), 4) AS fresh_ticket_rate_30d,
      MIN(rt.created_at) AS first_seen_at,
      MAX(COALESCE(rt.last_seen_at, rt.created_at)) AS last_seen_at
    FROM resolved_tickets rt
    GROUP BY rt.class_key, rt.source, rt.error_class, rt.fingerprint_root
  ),
  upserted AS (
    INSERT INTO public.ticket_classes (
      class_key,
      source,
      error_class,
      fingerprint_root,
      threshold_count,
      threshold_window_days,
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
      r.threshold_count,
      r.threshold_window_days,
      r.resolved_count_30d,
      r.occurrence_count_30d,
      r.fresh_ticket_rate_30d,
      CASE WHEN r.occurrence_count_30d >= r.threshold_count THEN r.fresh_ticket_rate_30d ELSE NULL END,
      r.first_seen_at,
      r.last_seen_at,
      CASE WHEN r.occurrence_count_30d >= r.threshold_count THEN now() ELSE NULL END,
      CASE WHEN r.occurrence_count_30d >= r.threshold_count THEN 'recurring' ELSE 'watching' END,
      jsonb_build_object(
        'class_root', r.class_key,
        'source', r.source::text,
        'error_class', r.error_class,
        'fingerprint_root', r.fingerprint_root,
        'threshold_count', r.threshold_count,
        'threshold_window_days', r.threshold_window_days
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
        OR linked_task.context->>'fix_outcome' = 'verified-stable'
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

REVOKE ALL ON FUNCTION public.rollup_ticket_classes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_ticket_classes() TO service_role;
