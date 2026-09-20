-- Phase 39: verified-email event discovery
--
-- Discovery is derived from the signed-in caller's current confirmed primary
-- email and active verified aliases. Historical participant rows remain
-- immutable and sparse identity_id links are never an authorization input.

BEGIN;

-- Support the only cross-organization participant lookup Phase 39 performs.
CREATE INDEX IF NOT EXISTS call_participants_email_event_confirmed_idx
  ON public.call_participants ((lower(trim(email))), event_id)
  WHERE email IS NOT NULL
    AND event_id IS NOT NULL
    AND (
      has_confirmed_speech = TRUE
      OR role = 'organizer'
      OR participant_type = 'host'
    );

-- Private authorization seam. This function deliberately has no subject or
-- email argument and no browser-executable grant.
CREATE OR REPLACE FUNCTION public.phase39_current_caller_emails()
RETURNS TABLE (email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT normalized.email
  FROM (
    SELECT lower(trim(au.email)) AS email
    FROM auth.users AS au
    WHERE au.id = auth.uid()
      AND au.email_confirmed_at IS NOT NULL
      AND NULLIF(trim(au.email), '') IS NOT NULL

    UNION

    SELECT lower(trim(ia.value)) AS email
    FROM public.identities AS i
    JOIN public.identity_aliases AS ia
      ON ia.identity_id = i.id
    WHERE i.owner_user_id = auth.uid()
      AND ia.alias_type = 'email'
      AND ia.verified = TRUE
      AND ia.verified_at IS NOT NULL
      AND NULLIF(trim(ia.value), '') IS NOT NULL
  ) AS normalized
$$;

REVOKE EXECUTE ON FUNCTION public.phase39_current_caller_emails()
  FROM PUBLIC, anon, authenticated, service_role;

-- A caller-safe boolean wrapper lets RLS use the private email set without
-- exposing that set itself.
CREATE OR REPLACE FUNCTION public.phase39_user_can_discover_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.phase38_event_allows_discovery(p_event_id)
    AND EXISTS (
      SELECT 1
      FROM public.call_participants AS cp
      JOIN public.phase39_current_caller_emails() AS caller
        ON caller.email = lower(trim(cp.email))
      WHERE cp.event_id = p_event_id
        AND (
          cp.has_confirmed_speech = TRUE
          OR cp.role = 'organizer'
          OR cp.participant_type = 'host'
        )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.phase39_user_can_discover_event(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase39_user_can_discover_event(UUID)
  TO authenticated, service_role;

-- Replace only the participant branch. Recording ownership remains an
-- independent route to the event and is not subject to discovery suppression.
DROP POLICY IF EXISTS "participants_and_owners_can_view_events" ON public.events;
CREATE POLICY "participants_and_owners_can_view_events"
  ON public.events FOR SELECT TO authenticated
  USING (
    public.phase39_user_can_discover_event(events.id)
    OR EXISTS (
      SELECT 1
      FROM public.recordings AS r
      WHERE r.event_id = events.id
        AND r.owner_user_id = auth.uid()
    )
  );

-- Preserve the Phase 38 helper signature while removing the stale
-- call_participants.identity_id dependency. The p_user_id overload remains
-- service-only and is used by existing Phase 38 SECURITY DEFINER functions.
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
    WHERE cp.event_id = p_event_id
      AND cp.email IS NOT NULL
      AND (
        cp.has_confirmed_speech = TRUE
        OR cp.role = 'organizer'
        OR cp.participant_type = 'host'
      )
      AND lower(trim(cp.email)) IN (
        SELECT lower(trim(au.email))
        FROM auth.users AS au
        WHERE au.id = p_user_id
          AND au.email_confirmed_at IS NOT NULL
          AND NULLIF(trim(au.email), '') IS NOT NULL

        UNION

        SELECT lower(trim(ia.value))
        FROM public.identities AS i
        JOIN public.identity_aliases AS ia
          ON ia.identity_id = i.id
        WHERE i.owner_user_id = p_user_id
          AND ia.alias_type = 'email'
          AND ia.verified = TRUE
          AND ia.verified_at IS NOT NULL
          AND NULLIF(trim(ia.value), '') IS NOT NULL
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_user_is_verified_confirmed_participant(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_user_is_verified_confirmed_participant(UUID, UUID)
  TO service_role;

-- Count confirmed participant email identities directly. This retains the
-- strict Phase 38 '< 50' boundary without waiting for identity enrichment.
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
      SELECT COUNT(DISTINCT lower(trim(cp.email)))
      FROM public.call_participants AS cp
      WHERE cp.event_id = p_event_id
        AND cp.email IS NOT NULL
        AND (
          cp.has_confirmed_speech = TRUE
          OR cp.role = 'organizer'
          OR cp.participant_type = 'host'
        )
    ) < 50
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_event_allows_discovery(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_event_allows_discovery(UUID)
  TO service_role;

-- Phase 38 content access keeps its exact policy behavior, but verified
-- participant matching now uses the same current-email evidence and works
-- when call_participants.identity_id is null.
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
    WHERE r.id = p_recording_id
      AND cp.email IS NOT NULL
      AND lower(trim(cp.email)) IN (
        SELECT lower(trim(au.email))
        FROM auth.users AS au
        WHERE au.id = p_user_id
          AND au.email_confirmed_at IS NOT NULL
          AND NULLIF(trim(au.email), '') IS NOT NULL

        UNION

        SELECT lower(trim(ia.value))
        FROM public.identities AS i
        JOIN public.identity_aliases AS ia
          ON ia.identity_id = i.id
        WHERE i.owner_user_id = p_user_id
          AND ia.alias_type = 'email'
          AND ia.verified = TRUE
          AND ia.verified_at IS NOT NULL
          AND NULLIF(trim(ia.value), '') IS NOT NULL
      )
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

REVOKE EXECUTE ON FUNCTION public.phase38_user_has_recording_participation(UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_user_has_recording_participation(UUID, UUID, BOOLEAN)
  TO service_role;

COMMIT;
