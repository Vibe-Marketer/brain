-- Migration: Sentry ticket ingestion (schema relaxation + atomic ingest RPC)
-- Purpose: SEN-01 + SEN-02 — let the tickets table hold system-created
--          (Sentry) tickets and perform race-safe fingerprint dedup.
--          reporter_id becomes nullable (NULL = system/telemetry reporter,
--          mirroring ticket_events.actor_id NULL semantics); occurrence_count
--          and last_seen_at track dedup hits; ingest_sentry_ticket is the
--          single atomic SECURITY DEFINER entry point the sentry-webhook
--          Edge Function calls via the service-role client (upsert + audit
--          event + admin notification in one transaction). Dedup is enforced
--          by the DB (partial unique index idx_tickets_fingerprint_unique +
--          ON CONFLICT), never by SELECT-then-INSERT application code.
-- Author: Phase 12 Plan 01 (sentry-ingestion)
-- Date: 2026-06-11

-- ============================================================================
-- TABLE ALTERATIONS: tickets
-- ============================================================================
-- NULL reporter = system/telemetry ticket. RLS policies are deliberately
-- untouched: the reporter SELECT policy (reporter_id = auth.uid()) never
-- matches NULL, so Sentry tickets remain admin-only-visible by construction.
ALTER TABLE public.tickets ALTER COLUMN reporter_id DROP NOT NULL;

-- Dedup occurrence tracking (Phase 12 schema gap — verified absent live).
ALTER TABLE public.tickets
  ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.tickets
  ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- FUNCTION: ingest_sentry_ticket
-- ============================================================================
-- Atomic Sentry ingestion: race-safe upsert keyed on the partial unique
-- index idx_tickets_fingerprint_unique, plus conditional audit/notification
-- writes — all in one transaction.
--
--   New fingerprint   -> ticket created (occurrence_count = 1),
--                        ticket_events 'created' row (actor NULL = system),
--                        and — when severity is critical/high — one
--                        user_notifications row per ADMIN user.
--   Known fingerprint -> occurrence_count incremented + last_seen_at
--                        advanced ONLY (first-seen severity/context/status
--                        win; no overwrite), ticket_events 'occurrence'
--                        row, NO re-notification (anti-storm decision).
--
-- SECURITY DEFINER + SET search_path = public follows the
-- log_ticket_status_change hardening idiom (20260611000002). Execution is
-- revoked from anon/authenticated below — service-role only.
CREATE OR REPLACE FUNCTION public.ingest_sentry_ticket(
  p_fingerprint TEXT,
  p_severity public.ticket_severity,
  p_context JSONB,
  p_notify_title TEXT,
  p_notify_body TEXT
)
RETURNS TABLE (ticket_id UUID, occurrence_count INTEGER, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ticket_id UUID;
  v_occurrence_count INTEGER;
  v_created BOOLEAN;
BEGIN
  -- Race-safe dedup: the partial unique index is the arbiter. Two
  -- concurrent deliveries of the same fingerprint yield exactly one
  -- ticket with occurrence_count = 2.
  INSERT INTO public.tickets (
    reporter_id, type, severity, status, source,
    fingerprint, context, occurrence_count, last_seen_at
  )
  VALUES (
    NULL, 'bug', p_severity, 'new', 'sentry',
    p_fingerprint, p_context, 1, NOW()
  )
  ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
  DO UPDATE SET
    occurrence_count = tickets.occurrence_count + 1,
    last_seen_at = NOW()
  RETURNING tickets.id, tickets.occurrence_count
  INTO v_ticket_id, v_occurrence_count;

  v_created := (v_occurrence_count = 1);

  IF v_created THEN
    -- Audit: 'created' lifecycle event, actor NULL = system
    -- (send-support-ticket idiom).
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    VALUES (v_ticket_id, NULL, 'created', 'new');

    -- Admin notification fan-out: create-only (dedup hits never re-notify)
    -- AND severity gate. 'critical' included for completeness even though
    -- telemetry mapping never auto-assigns it.
    IF p_severity IN ('critical', 'high') THEN
      INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
      SELECT
        ur.user_id,
        'system',
        p_notify_title,
        p_notify_body,
        jsonb_build_object(
          'ticket_id', v_ticket_id,
          'source', 'sentry',
          'severity', p_severity::text
        )
      FROM public.user_roles ur
      WHERE ur.role = 'ADMIN';
    END IF;
  ELSE
    -- Cheap audit signal on dedup hits (CONTEXT.md lean-yes discretion).
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    VALUES (v_ticket_id, NULL, 'occurrence', v_occurrence_count::text);
  END IF;

  RETURN QUERY SELECT v_ticket_id, v_occurrence_count, v_created;
END;
$function$;

-- ============================================================================
-- PRIVILEGES
-- ============================================================================
-- Service-role-only entry point: the Edge Function calls this via the
-- service-role client. Postgres grants EXECUTE to PUBLIC by default on new
-- functions — revoke it, then grant service_role explicitly.
REVOKE ALL ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT)
  TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN public.tickets.reporter_id IS
  'Reporting user; NULL = system/telemetry ticket (e.g. Sentry). NULL rows are admin-only-visible: the reporter RLS policy never matches NULL.';
COMMENT ON COLUMN public.tickets.occurrence_count IS
  'Number of times this ticket''s fingerprint has been ingested (SEN-02 dedup). Incremented by ingest_sentry_ticket on fingerprint conflict.';
COMMENT ON COLUMN public.tickets.last_seen_at IS
  'Timestamp of the most recent ingestion of this ticket''s fingerprint (SEN-02 dedup).';
COMMENT ON FUNCTION public.ingest_sentry_ticket(TEXT, public.ticket_severity, JSONB, TEXT, TEXT) IS
  'Atomic Sentry ticket ingestion (SEN-01/SEN-02): race-safe fingerprint upsert (ON CONFLICT on idx_tickets_fingerprint_unique), ticket_events audit row, and per-ADMIN user_notifications fan-out on newly created critical/high tickets. Service-role only — EXECUTE revoked from anon/authenticated.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
