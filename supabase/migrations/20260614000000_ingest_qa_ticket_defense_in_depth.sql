-- Phase 20 review fix (High-2): make ingest_qa_ticket defense-in-depth.
-- The original 20260613235000 migration already ran in prod; this CREATE OR REPLACE
-- adds two DB-enforced invariants: reject high/critical, and never demote a qa_review row.

CREATE OR REPLACE FUNCTION public.ingest_qa_ticket(
  p_fingerprint TEXT,
  p_severity public.ticket_severity,
  p_context JSONB,
  p_message_body TEXT,
  p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  ticket_id UUID,
  occurrence_count INTEGER,
  created BOOLEAN,
  promoted BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ticket_id UUID;
  v_occurrence_count INTEGER;
  v_created BOOLEAN;
  v_context JSONB;
  v_attachments JSONB;
  v_message_body TEXT;
  v_context_bytes INTEGER;
  v_attachments_bytes INTEGER;
BEGIN
  -- Defense-in-depth (High-2): the RPC is the source-stamped service-role boundary;
  -- it must enforce the severity invariant regardless of caller. High/critical QA
  -- findings belong in the qa_review/tier-2 lane and are NEVER auto-filed as fixable.
  IF p_severity IN ('high', 'critical') THEN
    RAISE EXCEPTION 'ingest_qa_ticket rejects high/critical severity (route to qa_review lane)'
      USING ERRCODE = '22023';
  END IF;

  IF p_fingerprint IS NULL OR length(trim(p_fingerprint)) = 0 THEN
    RAISE EXCEPTION 'p_fingerprint is required'
      USING ERRCODE = '22023';
  END IF;

  IF length(p_fingerprint) > 512 THEN
    RAISE EXCEPTION 'p_fingerprint exceeds 512 characters'
      USING ERRCODE = '22023';
  END IF;

  v_context := COALESCE(p_context, '{}'::jsonb);
  v_attachments := COALESCE(p_attachments, '[]'::jsonb);
  v_message_body := left(COALESCE(p_message_body, ''), 5000);
  v_context_bytes := octet_length(v_context::text);
  v_attachments_bytes := octet_length(v_attachments::text);

  IF jsonb_typeof(v_context) <> 'object' THEN
    RAISE EXCEPTION 'p_context must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_attachments) <> 'array' THEN
    RAISE EXCEPTION 'p_attachments must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  IF v_context_bytes > 65536 THEN
    RAISE EXCEPTION 'p_context exceeds 65536 bytes'
      USING ERRCODE = '22023';
  END IF;

  IF v_attachments_bytes > 32768 THEN
    RAISE EXCEPTION 'p_attachments exceeds 32768 bytes'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(v_attachments) > 10 THEN
    RAISE EXCEPTION 'p_attachments may contain at most 10 items'
      USING ERRCODE = '22023';
  END IF;

  -- Race-safe dedup: idx_tickets_fingerprint_unique is the arbiter. The
  -- initial severity/context/source win; dedup hits only bump occurrence time.
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
  VALUES (
    NULL,
    'bug',
    p_severity,
    'new',
    'nightly_qa',
    p_fingerprint,
    v_context,
    1,
    NOW()
  )
  ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
  DO UPDATE SET
    occurrence_count = tickets.occurrence_count + 1,
    last_seen_at = NOW()
  RETURNING tickets.id, tickets.occurrence_count
  INTO v_ticket_id, v_occurrence_count;

  v_created := (v_occurrence_count = 1);

  INSERT INTO public.qa_findings (
    fingerprint,
    lane,
    severity,
    route,
    selector,
    finding_type,
    message,
    first_seen_at,
    last_seen_at,
    occurrence_count,
    consecutive_nightly_count,
    repro_attempts,
    last_qa_run_id,
    promoted_ticket_id,
    context
  )
  VALUES (
    p_fingerprint,
    'promoted',
    p_severity,
    left(NULLIF(v_context->>'route', ''), 2048),
    left(NULLIF(v_context->>'selector', ''), 2048),
    left(NULLIF(v_context->>'finding_type', ''), 128),
    v_message_body,
    NOW(),
    NOW(),
    1,
    CASE
      WHEN (v_context->>'consecutive_nightly_count') ~ '^[0-9]+$'
        THEN GREATEST((v_context->>'consecutive_nightly_count')::integer, 1)
      ELSE 1
    END,
    COALESCE(v_context->'repro_attempts', '[]'::jsonb),
    CASE
      WHEN (v_context->>'qa_run_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (v_context->>'qa_run_id')::uuid
      ELSE NULL
    END,
    v_ticket_id,
    v_context
  )
  ON CONFLICT (fingerprint)
  DO UPDATE SET
    -- Defense-in-depth (High-2): never launder a qa_review (human-triage) row
    -- into 'promoted' via a dedup hit. Only non-review rows become promoted.
    lane = CASE WHEN public.qa_findings.lane = 'qa_review'
                THEN public.qa_findings.lane
                ELSE 'promoted' END,
    last_seen_at = NOW(),
    occurrence_count = public.qa_findings.occurrence_count + 1,
    consecutive_nightly_count = GREATEST(
      public.qa_findings.consecutive_nightly_count,
      CASE
        WHEN (EXCLUDED.context->>'consecutive_nightly_count') ~ '^[0-9]+$'
          THEN (EXCLUDED.context->>'consecutive_nightly_count')::integer
        ELSE public.qa_findings.consecutive_nightly_count
      END
    ),
    repro_attempts = EXCLUDED.repro_attempts,
    last_qa_run_id = EXCLUDED.last_qa_run_id,
    promoted_ticket_id = EXCLUDED.promoted_ticket_id,
    updated_at = NOW();

  IF v_created THEN
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    VALUES (v_ticket_id, NULL, 'created', 'new');

    INSERT INTO public.ticket_messages (
      ticket_id,
      author_type,
      author_id,
      body,
      attachments
    )
    VALUES (
      v_ticket_id,
      'agent',
      NULL,
      v_message_body,
      v_attachments
    );
  ELSE
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    VALUES (v_ticket_id, NULL, 'occurrence', v_occurrence_count::text);
  END IF;

  RETURN QUERY SELECT v_ticket_id, v_occurrence_count, v_created, TRUE;
END;
$function$;
