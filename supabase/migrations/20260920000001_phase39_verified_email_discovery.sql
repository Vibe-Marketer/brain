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

-- Count distinct events, never participant rows or recording copies.
CREATE OR REPLACE FUNCTION public.count_my_discovered_events()
RETURNS TABLE (event_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(DISTINCT e.id)::BIGINT AS event_count
  FROM public.events AS e
  JOIN public.call_participants AS cp
    ON cp.event_id = e.id
  JOIN public.phase39_current_caller_emails() AS caller
    ON caller.email = lower(trim(cp.email))
  WHERE auth.uid() IS NOT NULL
    AND (
      cp.has_confirmed_speech = TRUE
      OR cp.role = 'organizer'
      OR cp.participant_type = 'host'
    )
    AND public.phase38_event_allows_discovery(e.id)
$$;

REVOKE EXECUTE ON FUNCTION public.count_my_discovered_events()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_my_discovered_events()
  TO authenticated, service_role;

-- One row per event. Readable copies are allowlisted only after the Phase 38
-- content predicate succeeds. Restricted copies retain the exact anonymous
-- ordinal/request-state shape and no identifying recording fields.
CREATE OR REPLACE FUNCTION public.list_my_discovered_events(
  p_limit INTEGER DEFAULT 25,
  p_cursor TEXT DEFAULT NULL
)
RETURNS TABLE (
  event_id UUID,
  event_time TIMESTAMPTZ,
  connection JSONB,
  readable_copies JSONB,
  restricted_copies JSONB,
  state_group TEXT,
  next_cursor TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- The externally supplied bound is always reduced with LEAST(p_limit, 50).
  WITH caller_emails AS MATERIALIZED (
    SELECT caller.email
    FROM public.phase39_current_caller_emails() AS caller
  ),
  cursor_text AS (
    SELECT CASE
      WHEN p_cursor IS NULL THEN NULL
      ELSE convert_from(decode(p_cursor, 'base64'), 'UTF8')
    END AS value
  ),
  cursor_value AS (
    SELECT
      CASE WHEN value IS NULL THEN NULL ELSE split_part(value, '|', 1)::INTEGER END AS group_rank,
      CASE WHEN value IS NULL THEN NULL ELSE to_timestamp(split_part(value, '|', 2)::DOUBLE PRECISION) END AS event_time,
      CASE WHEN value IS NULL THEN NULL ELSE split_part(value, '|', 3)::UUID END AS event_id
    FROM cursor_text
  ),
  eligible_events AS MATERIALIZED (
    SELECT
      e.id,
      COALESCE(e.canonical_start_time, e.created_at) AS event_time,
      MIN(caller.email) AS matched_email
    FROM public.events AS e
    JOIN public.call_participants AS cp
      ON cp.event_id = e.id
    JOIN caller_emails AS caller
      ON caller.email = lower(trim(cp.email))
    WHERE auth.uid() IS NOT NULL
      AND (
        cp.has_confirmed_speech = TRUE
        OR cp.role = 'organizer'
        OR cp.participant_type = 'host'
      )
      AND public.phase38_event_allows_discovery(e.id)
    GROUP BY e.id, e.canonical_start_time, e.created_at
  ),
  copy_rows AS MATERIALIZED (
    SELECT
      ee.id AS event_id,
      r.id AS recording_id,
      r.recording_start_time,
      row_number() OVER (
        PARTITION BY ee.id
        ORDER BY r.created_at, r.id
      )::INTEGER AS copy_ordinal,
      public.phase38_user_can_access_recording(r.id) AS is_readable,
      latest.status AS request_status,
      latest.cooldown_until
    FROM eligible_events AS ee
    JOIN public.recordings AS r
      ON r.event_id = ee.id
    LEFT JOIN LATERAL (
      SELECT rar.status, rar.cooldown_until
      FROM public.recording_access_requests AS rar
      WHERE rar.recording_id = r.id
        AND rar.requester_user_id = auth.uid()
      ORDER BY rar.created_at DESC, rar.id DESC
      LIMIT 1
    ) AS latest ON TRUE
  ),
  event_projection AS (
    SELECT
      ee.id AS event_id,
      ee.event_time,
      jsonb_build_object(
        'verified_email',
        left(ee.matched_email, 1) || '***@' || split_part(ee.matched_email, '@', 2),
        'verified_email_count',
        (SELECT COUNT(*) FROM caller_emails)
      ) AS connection,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'recording_id', cr.recording_id,
            'recording_start_time', cr.recording_start_time
          ) ORDER BY cr.copy_ordinal
        ) FILTER (WHERE cr.is_readable),
        '[]'::JSONB
      ) AS readable_copies,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'copy_ordinal', cr.copy_ordinal,
            -- Opaque action handle used only by the existing Phase 38 request
            -- mutation. The UI renders the ordinal and never exposes this ID.
            'request_target', CASE
              WHEN NOT (
                cr.request_status = 'pending'
                OR (
                  cr.request_status = 'denied'
                  AND cr.cooldown_until IS NOT NULL
                  AND cr.cooldown_until > NOW()
                )
              ) THEN cr.recording_id
              ELSE NULL
            END,
            'request_status', CASE
              WHEN cr.request_status = 'pending' THEN 'pending'
              WHEN cr.request_status = 'denied'
                AND cr.cooldown_until IS NOT NULL
                AND cr.cooldown_until > NOW() THEN 'cooldown'
              ELSE 'available'
            END,
            'cooldown_until', CASE
              WHEN cr.request_status = 'denied' AND cr.cooldown_until > NOW()
                THEN cr.cooldown_until
              ELSE NULL
            END
          ) ORDER BY cr.copy_ordinal
        ) FILTER (WHERE NOT cr.is_readable),
        '[]'::JSONB
      ) AS restricted_copies,
      BOOL_OR(
        NOT cr.is_readable
        AND NOT (
          cr.request_status = 'pending'
          OR (
            cr.request_status = 'denied'
            AND cr.cooldown_until IS NOT NULL
            AND cr.cooldown_until > NOW()
          )
        )
      ) AS has_action,
      BOOL_OR(cr.is_readable) AS has_readable
    FROM eligible_events AS ee
    JOIN copy_rows AS cr
      ON cr.event_id = ee.id
    GROUP BY ee.id, ee.event_time, ee.matched_email
  ),
  ranked AS (
    SELECT
      ep.*,
      CASE
        WHEN ep.has_action THEN 'needs_action'
        WHEN ep.has_readable THEN 'available'
        ELSE 'waiting'
      END AS state_group,
      CASE
        WHEN ep.has_action THEN 1
        WHEN ep.has_readable THEN 2
        ELSE 3
      END AS group_rank
    FROM event_projection AS ep
  ),
  after_cursor AS (
    SELECT ranked.*
    FROM ranked
    CROSS JOIN cursor_value AS cursor
    WHERE cursor.group_rank IS NULL
      OR (ranked.group_rank, -EXTRACT(EPOCH FROM ranked.event_time), ranked.event_id)
        > (cursor.group_rank, -EXTRACT(EPOCH FROM cursor.event_time), cursor.event_id)
  ),
  limited AS (
    SELECT
      after_cursor.*,
      row_number() OVER (
        ORDER BY after_cursor.group_rank, after_cursor.event_time DESC, after_cursor.event_id
      ) AS page_row
    FROM after_cursor
    ORDER BY after_cursor.group_rank, after_cursor.event_time DESC, after_cursor.event_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50) + 1
  ),
  page AS (
    SELECT limited.*
    FROM limited
    WHERE limited.page_row <= LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50)
  ),
  page_meta AS (
    SELECT CASE
      WHEN COUNT(*) FILTER (
        WHERE limited.page_row > LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50)
      ) > 0
      THEN (
        SELECT encode(convert_to(
          boundary.group_rank::TEXT || '|' ||
          EXTRACT(EPOCH FROM boundary.event_time)::TEXT || '|' ||
          boundary.event_id::TEXT,
          'UTF8'
        ), 'base64')
        FROM limited AS boundary
        WHERE boundary.page_row = LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50)
      )
      ELSE NULL
    END AS next_cursor
    FROM limited
  )
  SELECT
    page.event_id,
    page.event_time,
    page.connection,
    page.readable_copies,
    page.restricted_copies,
    page.state_group,
    page_meta.next_cursor
  FROM page
  CROSS JOIN page_meta
  ORDER BY page.group_rank, page.event_time DESC, page.event_id
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_discovered_events(INTEGER, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_discovered_events(INTEGER, TEXT)
  TO authenticated, service_role;

COMMIT;
