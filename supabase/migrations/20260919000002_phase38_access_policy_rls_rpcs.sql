-- Phase 38: hardened recording authorization, private discovery, and request lifecycle.
-- Existing recording SELECT policies remain in place; this migration only adds paths.

BEGIN;

-- ---------------------------------------------------------------------------
-- RLS and direct-write boundaries
-- ---------------------------------------------------------------------------

ALTER TABLE public.recording_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_access_email_outbox FORCE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.recording_access_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.recording_access_grants FROM anon, authenticated;
REVOKE ALL ON TABLE public.recording_access_audit_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.recording_access_email_outbox FROM anon, authenticated;

GRANT SELECT ON TABLE public.recording_access_requests TO authenticated;
GRANT SELECT ON TABLE public.recording_access_grants TO authenticated;
GRANT ALL ON TABLE public.recording_access_requests TO service_role;
GRANT ALL ON TABLE public.recording_access_grants TO service_role;
GRANT ALL ON TABLE public.recording_access_audit_log TO service_role;
GRANT ALL ON TABLE public.recording_access_email_outbox TO service_role;

CREATE POLICY "Owners and requesters can view recording access requests"
  ON public.recording_access_requests
  FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.recordings AS r
      WHERE r.id = recording_access_requests.recording_id
        AND r.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and grantees can view recording access grants"
  ON public.recording_access_grants
  FOR SELECT TO authenticated
  USING (
    grantee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.recordings AS r
      WHERE r.id = recording_access_grants.recording_id
        AND r.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages recording access requests"
  ON public.recording_access_requests FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role manages recording access grants"
  ON public.recording_access_grants FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role manages recording access audit"
  ON public.recording_access_audit_log FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role manages recording access email outbox"
  ON public.recording_access_email_outbox FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- The original INSERT policy omitted a role and therefore allowed every role
-- with table INSERT privilege to forge notifications.
DROP POLICY IF EXISTS "Service can insert notifications" ON public.user_notifications;
REVOKE INSERT ON TABLE public.user_notifications FROM anon, authenticated;
GRANT INSERT ON TABLE public.user_notifications TO service_role;

CREATE POLICY "Service role can insert notifications"
  ON public.user_notifications FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Internal evidence and authorization predicates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.phase38_recording_event_kind(
  p_source_app TEXT,
  p_source_metadata JSONB
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_source_app, '')) <> 'zoom' THEN 'unknown'
    WHEN jsonb_typeof(COALESCE(p_source_metadata, '{}'::JSONB) -> 'zoom_type') <> 'number' THEN 'unknown'
    WHEN (p_source_metadata ->> 'zoom_type') !~ '^[0-9]+$' THEN 'unknown'
    WHEN ((p_source_metadata ->> 'zoom_type')::INTEGER) IN (5, 6, 9) THEN 'webinar'
    WHEN ((p_source_metadata ->> 'zoom_type')::INTEGER) IN (1, 2, 3, 4, 7, 8, 99) THEN 'non_webinar'
    ELSE 'unknown'
  END
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_recording_event_kind(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_recording_event_kind(TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.phase38_user_is_verified_confirmed_participant(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.call_participants AS cp
    JOIN public.identities AS i
      ON i.id = cp.identity_id
     AND i.owner_user_id = p_user_id
    JOIN public.identity_aliases AS ia
      ON ia.identity_id = i.id
     AND ia.alias_type = 'email'
     AND ia.verified = TRUE
     AND lower(ia.value) = lower(cp.email)
    WHERE cp.event_id = p_event_id
      AND (
        cp.has_confirmed_speech = TRUE
        OR cp.role = 'organizer'
        OR cp.participant_type = 'host'
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_user_is_verified_confirmed_participant(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_user_is_verified_confirmed_participant(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.phase38_event_allows_discovery(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM public.recordings AS r
      WHERE r.event_id = p_event_id
        AND public.phase38_recording_event_kind(r.source_app, r.source_metadata) = 'webinar'
    )
    AND (
      SELECT COUNT(DISTINCT cp.identity_id)
      FROM public.call_participants AS cp
      JOIN public.identities AS i ON i.id = cp.identity_id
      WHERE cp.event_id = p_event_id
        AND cp.identity_id IS NOT NULL
        AND (
          cp.has_confirmed_speech = TRUE
          OR cp.role = 'organizer'
          OR cp.participant_type = 'host'
        )
        AND EXISTS (
          SELECT 1
          FROM public.identity_aliases AS ia
          WHERE ia.identity_id = i.id
            AND ia.alias_type = 'email'
            AND ia.verified = TRUE
            AND lower(ia.value) = lower(cp.email)
        )
    ) < 50
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_event_allows_discovery(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_event_allows_discovery(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.phase38_user_has_recording_participation(
  p_recording_id UUID,
  p_user_id UUID,
  p_allow_invitee BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.recordings AS r
    JOIN public.call_participants AS cp
      ON cp.recording_id = r.id
      OR (r.event_id IS NOT NULL AND cp.event_id = r.event_id)
    JOIN public.identities AS i
      ON i.id = cp.identity_id
     AND i.owner_user_id = p_user_id
    JOIN public.identity_aliases AS ia
      ON ia.identity_id = i.id
     AND ia.alias_type = 'email'
     AND ia.verified = TRUE
     AND lower(ia.value) = lower(cp.email)
    WHERE r.id = p_recording_id
      AND (
        cp.has_confirmed_speech = TRUE
        OR cp.role = 'organizer'
        OR cp.participant_type = 'host'
        OR (
          p_allow_invitee
          AND cp.role IN ('invitee', 'attendee', 'speaker')
          AND cp.sources && ARRAY[
            'calendar_invitees', 'transcript', 'transcript_speaker', 'recorded_by'
          ]::TEXT[]
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_user_has_recording_participation(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_user_has_recording_participation(UUID, UUID, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.phase38_user_can_access_recording(p_recording_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT
      r.owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.recording_access_grants AS rag
        WHERE rag.recording_id = r.id
          AND rag.grantee_user_id = auth.uid()
          AND rag.revoked_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.call_share_links AS csl
        WHERE csl.call_recording_id = r.fathom_provider_id
          AND csl.user_id = r.owner_user_id
          AND csl.status = 'active'
          AND csl.recipient_email IS NOT NULL
          AND lower(csl.recipient_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
          AND (csl.expires_at IS NULL OR csl.expires_at > NOW())
      )
      OR (
        r.access_level = 'attendees'
        AND public.phase38_user_has_recording_participation(r.id, auth.uid(), FALSE)
      )
      OR (
        r.access_level = 'invitees'
        AND public.phase38_user_has_recording_participation(r.id, auth.uid(), TRUE)
      )
      OR (
        r.access_level = 'organization'
        AND public.is_organization_member(r.organization_id, auth.uid())
      )
    FROM public.recordings AS r
    WHERE r.id = p_recording_id
  ), FALSE)
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_user_can_access_recording(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase38_user_can_access_recording(UUID) TO authenticated, service_role;

-- Additive only: owner/admin/workspace/team/coach policies are not replaced.
CREATE POLICY "Phase 38 recording policy and grants"
  ON public.recordings FOR SELECT TO authenticated
  USING (public.phase38_user_can_access_recording(recordings.id));

-- ---------------------------------------------------------------------------
-- Policy management RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_recording_access_policy(p_recording_id UUID)
RETURNS TABLE (access_level TEXT, access_policy_origin TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.access_level, r.access_policy_origin
  FROM public.recordings AS r
  WHERE r.id = p_recording_id
    AND r.owner_user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_recording_access_policy(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recording_access_policy(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_default_recording_access_level(p_access_level TEXT)
RETURNS TABLE (default_recording_access_level TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_access_level NOT IN ('private', 'attendees', 'invitees', 'organization', 'link', 'public') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ACCESS_LEVEL';
  END IF;

  INSERT INTO public.user_settings (user_id, default_recording_access_level)
  VALUES (v_user_id, p_access_level)
  ON CONFLICT (user_id) DO UPDATE
    SET default_recording_access_level = EXCLUDED.default_recording_access_level,
        updated_at = NOW();

  INSERT INTO public.recording_access_audit_log (actor_user_id, action, metadata)
  VALUES (v_user_id, 'default_set', jsonb_build_object('access_level', p_access_level));

  RETURN QUERY SELECT p_access_level;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_default_recording_access_level(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_recording_access_level(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_recording_access_level(
  p_recording_id UUID,
  p_access_level TEXT
)
RETURNS TABLE (access_level TEXT, access_policy_origin TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_access_level NOT IN ('private', 'attendees', 'invitees', 'organization', 'link', 'public') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ACCESS_LEVEL';
  END IF;

  SELECT r.owner_user_id INTO v_owner_id
  FROM public.recordings AS r
  WHERE r.id = p_recording_id
  FOR UPDATE;

  IF v_owner_id IS NULL OR v_owner_id <> v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RECORDING_NOT_AVAILABLE';
  END IF;

  UPDATE public.recordings AS r
  SET access_level = p_access_level,
      access_policy_origin = 'custom'
  WHERE r.id = p_recording_id;

  INSERT INTO public.recording_access_audit_log (
    recording_id, actor_user_id, action, metadata
  ) VALUES (
    p_recording_id, v_user_id, 'policy_set', jsonb_build_object('access_level', p_access_level)
  );

  RETURN QUERY SELECT p_access_level, 'custom'::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_recording_access_level(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_recording_access_level(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_recording_access_level(p_recording_id UUID)
RETURNS TABLE (access_level TEXT, access_policy_origin TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner_id UUID;
  v_default TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT r.owner_user_id INTO v_owner_id
  FROM public.recordings AS r
  WHERE r.id = p_recording_id
  FOR UPDATE;

  IF v_owner_id IS NULL OR v_owner_id <> v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RECORDING_NOT_AVAILABLE';
  END IF;

  SELECT COALESCE(us.default_recording_access_level, 'private') INTO v_default
  FROM public.user_settings AS us
  WHERE us.user_id = v_user_id;
  v_default := COALESCE(v_default, 'private');

  UPDATE public.recordings AS r
  SET access_level = v_default,
      access_policy_origin = 'default'
  WHERE r.id = p_recording_id;

  INSERT INTO public.recording_access_audit_log (
    recording_id, actor_user_id, action, metadata
  ) VALUES (
    p_recording_id, v_user_id, 'policy_reset', jsonb_build_object('access_level', v_default)
  );

  RETURN QUERY SELECT v_default, 'default'::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_recording_access_level(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_recording_access_level(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Privacy-safe event existence and anonymous copy discovery
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_existence_for_participant(p_event_id UUID)
RETURNS TABLE (event_id UUID, has_other_copies BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_event_id, EXISTS (
    SELECT 1
    FROM public.recordings AS r
    WHERE r.event_id = p_event_id
      AND NOT public.phase38_user_can_access_recording(r.id)
  )
  WHERE auth.uid() IS NOT NULL
    AND public.phase38_user_is_verified_confirmed_participant(p_event_id, auth.uid())
    AND public.phase38_event_allows_discovery(p_event_id)
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_existence_for_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_existence_for_participant(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_discoverable_recording_copies(p_event_id UUID)
RETURNS TABLE (
  copy_ordinal INTEGER,
  recording_id UUID,
  request_status TEXT,
  cooldown_until TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH event_copies AS (
    SELECT
      r.id,
      row_number() OVER (ORDER BY r.created_at, r.id)::INTEGER AS ordinal
    FROM public.recordings AS r
    WHERE r.event_id = p_event_id
  )
  SELECT
    ec.ordinal,
    ec.id,
    latest.status,
    latest.cooldown_until
  FROM event_copies AS ec
  LEFT JOIN LATERAL (
    SELECT rar.status, rar.cooldown_until
    FROM public.recording_access_requests AS rar
    WHERE rar.recording_id = ec.id
      AND rar.requester_user_id = auth.uid()
    ORDER BY rar.created_at DESC, rar.id DESC
    LIMIT 1
  ) AS latest ON TRUE
  WHERE auth.uid() IS NOT NULL
    AND public.phase38_user_is_verified_confirmed_participant(p_event_id, auth.uid())
    AND public.phase38_event_allows_discovery(p_event_id)
    AND NOT public.phase38_user_can_access_recording(ec.id)
  ORDER BY ec.ordinal
$$;

REVOKE EXECUTE ON FUNCTION public.list_discoverable_recording_copies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_discoverable_recording_copies(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Request, approve, deny, management, and revoke lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_recording_access(
  p_recording_id UUID,
  p_test_now TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (request_id UUID, status TEXT, cooldown_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := COALESCE(p_test_now, NOW());
  v_recording RECORD;
  v_existing public.recording_access_requests%ROWTYPE;
  v_requester RECORD;
  v_request_id UUID;
  v_owner_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;

  -- Deterministic clock control exists only for the dedicated integration
  -- project. A production JWT cannot advance time to bypass the cooldown.
  IF p_test_now IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'iss', '') <>
       'https://swjzxiddcrtaqixsfaac.supabase.co/auth/v1' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'TEST_CLOCK_FORBIDDEN';
  END IF;

  SELECT r.id, r.event_id, r.owner_user_id
    INTO v_recording
  FROM public.recordings AS r
  WHERE r.id = p_recording_id
  FOR UPDATE;

  IF v_recording.id IS NULL OR v_recording.event_id IS NULL OR v_recording.owner_user_id = v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RECORDING_NOT_AVAILABLE';
  END IF;

  IF NOT public.phase38_user_is_verified_confirmed_participant(v_recording.event_id, v_user_id)
     OR NOT public.phase38_event_allows_discovery(v_recording.event_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RECORDING_NOT_AVAILABLE';
  END IF;

  IF public.phase38_user_can_access_recording(p_recording_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCESS_ALREADY_AVAILABLE';
  END IF;

  SELECT rar.* INTO v_existing
  FROM public.recording_access_requests AS rar
  WHERE rar.recording_id = p_recording_id
    AND rar.requester_user_id = v_user_id
    AND rar.status = 'pending'
  ORDER BY rar.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing.id, v_existing.status, v_existing.cooldown_until;
    RETURN;
  END IF;

  SELECT rar.* INTO v_existing
  FROM public.recording_access_requests AS rar
  WHERE rar.recording_id = p_recording_id
    AND rar.requester_user_id = v_user_id
    AND rar.status = 'denied'
  ORDER BY rar.denied_at DESC NULLS LAST, rar.created_at DESC
  LIMIT 1;

  IF v_existing.cooldown_until IS NOT NULL AND v_now < v_existing.cooldown_until THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_COOLDOWN_ACTIVE';
  END IF;

  SELECT
    cp.name,
    ia.value AS verified_email,
    jsonb_build_object(
      'participant_role', cp.role,
      'participant_type', cp.participant_type,
      'has_confirmed_speech', cp.has_confirmed_speech,
      'sources', cp.sources
    ) AS evidence
    INTO v_requester
  FROM public.call_participants AS cp
  JOIN public.identities AS i
    ON i.id = cp.identity_id
   AND i.owner_user_id = v_user_id
  JOIN public.identity_aliases AS ia
    ON ia.identity_id = i.id
   AND ia.alias_type = 'email'
   AND ia.verified = TRUE
   AND lower(ia.value) = lower(cp.email)
  WHERE cp.event_id = v_recording.event_id
    AND (
      cp.has_confirmed_speech = TRUE
      OR cp.role = 'organizer'
      OR cp.participant_type = 'host'
    )
  ORDER BY cp.created_at
  LIMIT 1;

  IF v_requester.verified_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RECORDING_NOT_AVAILABLE';
  END IF;

  INSERT INTO public.recording_access_requests (
    recording_id,
    requester_user_id,
    requester_verified_email,
    requester_name,
    evidence,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_recording_id,
    v_user_id,
    v_requester.verified_email,
    v_requester.name,
    v_requester.evidence,
    'pending',
    v_now,
    v_now
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.recording_access_audit_log (
    recording_id, request_id, actor_user_id, action, metadata, created_at
  ) VALUES (
    p_recording_id,
    v_request_id,
    v_user_id,
    'requested',
    jsonb_build_object('event_id', v_recording.event_id),
    v_now
  );

  INSERT INTO public.user_notifications (user_id, type, title, body, metadata, created_at)
  VALUES (
    v_recording.owner_user_id,
    'recording_access_requested',
    'Recording access requested',
    'A confirmed participant requested access to one of your recordings.',
    jsonb_build_object(
      'request_id', v_request_id,
      'recording_id', p_recording_id,
      'route', '/calls/' || p_recording_id::TEXT || '?accessRequest=' || v_request_id::TEXT
    ),
    v_now
  );

  SELECT au.email INTO v_owner_email
  FROM auth.users AS au
  WHERE au.id = v_recording.owner_user_id;

  INSERT INTO public.recording_access_email_outbox (
    recording_id,
    request_id,
    recipient_user_id,
    recipient_email,
    delivery_kind,
    status,
    payload_snapshot,
    idempotency_key,
    next_attempt_at,
    created_at,
    updated_at
  ) VALUES (
    p_recording_id,
    v_request_id,
    v_recording.owner_user_id,
    v_owner_email,
    'owner_request_review',
    'pending',
    jsonb_build_object('request_id', v_request_id, 'template', 'recording_access_requested'),
    'recording-access-request:' || v_request_id::TEXT,
    v_now,
    v_now,
    v_now
  );

  RETURN QUERY SELECT v_request_id, 'pending'::TEXT, NULL::TIMESTAMPTZ;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_recording_access(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_recording_access(UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_recording_access_management(p_recording_id UUID)
RETURNS TABLE (
  request_id UUID,
  request_status TEXT,
  requester_name TEXT,
  requester_verified_email TEXT,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  evidence JSONB,
  cooldown_until TIMESTAMPTZ,
  grant_id UUID,
  grantee_user_id UUID,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    rar.id,
    rar.status,
    rar.requester_name,
    rar.requester_verified_email,
    r.title,
    COALESCE(r.recording_start_time, r.created_at),
    rar.evidence,
    rar.cooldown_until,
    rag.id,
    rag.grantee_user_id,
    rag.granted_at,
    rag.revoked_at
  FROM public.recordings AS r
  JOIN public.recording_access_requests AS rar ON rar.recording_id = r.id
  LEFT JOIN public.recording_access_grants AS rag
    ON rag.source_request_id = rar.id
  WHERE r.id = p_recording_id
    AND r.owner_user_id = auth.uid()
  ORDER BY
    CASE WHEN rar.status = 'pending' THEN 0 ELSE 1 END,
    rar.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.get_recording_access_management(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recording_access_management(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_recording_access_request(p_request_id UUID)
RETURNS TABLE (request_id UUID, grant_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
  v_grant_id UUID;
BEGIN
  SELECT rar.*, r.owner_user_id
    INTO v_request
  FROM public.recording_access_requests AS rar
  JOIN public.recordings AS r ON r.id = rar.recording_id
  WHERE rar.id = p_request_id
  FOR UPDATE OF rar;

  IF v_user_id IS NULL OR v_request.id IS NULL OR v_request.owner_user_id <> v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'REQUEST_NOT_AVAILABLE';
  END IF;

  IF v_request.status = 'denied' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ALREADY_RESOLVED';
  END IF;

  IF v_request.status = 'approved' THEN
    SELECT rag.id INTO v_grant_id
    FROM public.recording_access_grants AS rag
    WHERE rag.source_request_id = p_request_id
      AND rag.revoked_at IS NULL
    ORDER BY rag.granted_at DESC
    LIMIT 1;
    RETURN QUERY SELECT p_request_id, v_grant_id, 'approved'::TEXT;
    RETURN;
  END IF;

  UPDATE public.recording_access_requests AS rar
  SET status = 'approved',
      resolved_by_user_id = v_user_id,
      resolved_at = NOW(),
      approved_at = NOW(),
      denied_at = NULL,
      cooldown_until = NULL,
      updated_at = NOW()
  WHERE rar.id = p_request_id;

  INSERT INTO public.recording_access_grants (
    recording_id, grantee_user_id, source_request_id, granted_by_user_id
  ) VALUES (
    v_request.recording_id, v_request.requester_user_id, p_request_id, v_user_id
  )
  ON CONFLICT (recording_id, grantee_user_id) WHERE revoked_at IS NULL
  DO UPDATE SET source_request_id = COALESCE(public.recording_access_grants.source_request_id, EXCLUDED.source_request_id)
  RETURNING id INTO v_grant_id;

  INSERT INTO public.recording_access_audit_log (
    recording_id, request_id, grant_id, actor_user_id, action
  ) VALUES (
    v_request.recording_id, p_request_id, v_grant_id, v_user_id, 'approved'
  );

  INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
  VALUES (
    v_request.requester_user_id,
    'recording_access_approved',
    'Recording access approved',
    'Your recording access request was approved.',
    jsonb_build_object('request_id', p_request_id, 'recording_id', v_request.recording_id)
  );

  RETURN QUERY SELECT p_request_id, v_grant_id, 'approved'::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_recording_access_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_recording_access_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.deny_recording_access_request(p_request_id UUID)
RETURNS TABLE (request_id UUID, status TEXT, cooldown_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
  v_denied_at TIMESTAMPTZ;
  v_cooldown_until TIMESTAMPTZ;
BEGIN
  SELECT rar.*, r.owner_user_id
    INTO v_request
  FROM public.recording_access_requests AS rar
  JOIN public.recordings AS r ON r.id = rar.recording_id
  WHERE rar.id = p_request_id
  FOR UPDATE OF rar;

  IF v_user_id IS NULL OR v_request.id IS NULL OR v_request.owner_user_id <> v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'REQUEST_NOT_AVAILABLE';
  END IF;

  IF v_request.status = 'approved' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ALREADY_RESOLVED';
  END IF;

  IF v_request.status = 'denied' THEN
    RETURN QUERY SELECT p_request_id, 'denied'::TEXT, v_request.cooldown_until;
    RETURN;
  END IF;

  v_denied_at := NOW();
  v_cooldown_until := v_denied_at + INTERVAL '30 days';

  UPDATE public.recording_access_requests AS rar
  SET status = 'denied',
      resolved_by_user_id = v_user_id,
      resolved_at = v_denied_at,
      denied_at = v_denied_at,
      cooldown_until = v_cooldown_until,
      updated_at = v_denied_at
  WHERE rar.id = p_request_id;

  INSERT INTO public.recording_access_audit_log (
    recording_id, request_id, actor_user_id, action
  ) VALUES (
    v_request.recording_id, p_request_id, v_user_id, 'denied'
  );

  INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
  VALUES (
    v_request.requester_user_id,
    'recording_access_denied',
    'Recording access request updated',
    'Your recording access request was not approved. You may request again after the cooldown.',
    jsonb_build_object(
      'request_id', p_request_id,
      'recording_id', v_request.recording_id,
      'cooldown_until', v_cooldown_until
    )
  );

  RETURN QUERY SELECT p_request_id, 'denied'::TEXT, v_cooldown_until;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deny_recording_access_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deny_recording_access_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_recording_access_grant(p_grant_id UUID)
RETURNS TABLE (grant_id UUID, status TEXT, revoked_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_grant RECORD;
  v_revoked_at TIMESTAMPTZ;
BEGIN
  SELECT rag.*, r.owner_user_id
    INTO v_grant
  FROM public.recording_access_grants AS rag
  JOIN public.recordings AS r ON r.id = rag.recording_id
  WHERE rag.id = p_grant_id
  FOR UPDATE OF rag;

  IF v_user_id IS NULL OR v_grant.id IS NULL OR v_grant.owner_user_id <> v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'GRANT_NOT_AVAILABLE';
  END IF;

  IF v_grant.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT p_grant_id, 'revoked'::TEXT, v_grant.revoked_at;
    RETURN;
  END IF;

  v_revoked_at := NOW();
  UPDATE public.recording_access_grants AS rag
  SET revoked_at = v_revoked_at,
      revoked_by_user_id = v_user_id
  WHERE rag.id = p_grant_id;

  INSERT INTO public.recording_access_audit_log (
    recording_id, request_id, grant_id, actor_user_id, action
  ) VALUES (
    v_grant.recording_id, v_grant.source_request_id, p_grant_id, v_user_id, 'revoked'
  );

  INSERT INTO public.user_notifications (user_id, type, title, body, metadata)
  VALUES (
    v_grant.grantee_user_id,
    'recording_access_revoked',
    'Recording access ended',
    'The recording owner ended your access.',
    jsonb_build_object('grant_id', p_grant_id, 'recording_id', v_grant.recording_id)
  );

  RETURN QUERY SELECT p_grant_id, 'revoked'::TEXT, v_revoked_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_recording_access_grant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_recording_access_grant(UUID) TO authenticated;

COMMIT;
