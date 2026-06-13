-- Migration: Source attribution backfill and metrics
-- Purpose: SRC-01 + SRC-03 — correct known operational source stamps and
--          expose admin-only per-source ticket metrics for the authenticated
--          Admin Center RPC path.
-- Author: Phase 18 Plan 01 (source attribution)
-- Date: 2026-06-13

-- Known watchdog tickets were filed through the manual/person path before
-- source attribution existed. The live sample showed the explicit origin
-- marker below, so this rewrite is narrow and auditable.
UPDATE public.tickets
SET source = 'internal'
WHERE source = 'manual'
  AND context->>'origin' = 'autopilot-watchdog';

-- Nightly QA tickets were also filed through the manual/person path. The live
-- sample showed qa-nightly-crawler as the explicit crawler marker.
UPDATE public.tickets
SET source = 'nightly_qa'
WHERE source = 'manual'
  AND context->>'userAgent' = 'qa-nightly-crawler';

-- Conservative fallback only for system rows that cannot be attributed.
-- Do not rewrite reporter-owned manual/person tickets into an operational
-- bucket, and never infer person-reported status from legacy ambiguity.
UPDATE public.tickets
SET source = 'unknown'
WHERE source = 'manual'
  AND reporter_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_source_created_at
  ON public.tickets(source, created_at DESC);

CREATE OR REPLACE FUNCTION public.ticket_source_metrics()
RETURNS TABLE (
  source public.ticket_source,
  volume BIGINT,
  resolved BIGINT,
  fix_rate NUMERIC,
  avg_cycle_time_hours NUMERIC
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
  WITH first_resolved_events AS (
    SELECT
      ticket_id,
      MIN(created_at) AS resolved_at
    FROM public.ticket_events
    WHERE event_type = 'status_change'
      AND new_value = 'resolved'
    GROUP BY ticket_id
  )
  SELECT
    t.source,
    COUNT(*) AS volume,
    COUNT(*) FILTER (WHERE t.status = 'resolved') AS resolved,
    CASE
      WHEN COUNT(*) = 0 THEN 0::NUMERIC
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE t.status = 'resolved'))::NUMERIC
        / COUNT(*)::NUMERIC,
        4
      )
    END AS fix_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (fre.resolved_at - t.created_at)) / 3600.0),
      2
    ) AS avg_cycle_time_hours
  FROM public.tickets t
  LEFT JOIN first_resolved_events fre ON fre.ticket_id = t.id
  GROUP BY t.source
  ORDER BY t.source::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.ticket_source_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_source_metrics() TO authenticated;

COMMENT ON FUNCTION public.ticket_source_metrics() IS
  'Admin-only source attribution metrics for tickets: source volume, resolved count, fix rate, and average cycle time from first resolved status-change event.';
