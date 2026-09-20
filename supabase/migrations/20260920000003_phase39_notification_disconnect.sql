-- Phase 39: exact-once discovery notifications and verified-email disconnect.
--
-- The notification ledger is private infrastructure. A null event_id row is
-- the caller's silent activation marker; non-null rows retain per-event
-- idempotency across alias disconnect and reconnect.

BEGIN;

CREATE TABLE public.event_discovery_notification_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id),
  CONSTRAINT event_discovery_notification_ledger_shape CHECK (
    (event_id IS NULL AND notified_at IS NULL)
    OR event_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX event_discovery_notification_ledger_baseline_uidx
  ON public.event_discovery_notification_ledger (user_id)
  WHERE event_id IS NULL;

CREATE INDEX event_discovery_notification_ledger_event_idx
  ON public.event_discovery_notification_ledger (event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE public.event_discovery_notification_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_discovery_notification_ledger FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages discovery notification ledger"
  ON public.event_discovery_notification_ledger
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

REVOKE ALL ON TABLE public.event_discovery_notification_ledger
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.event_discovery_notification_ledger
  TO service_role;

CREATE OR REPLACE FUNCTION public.sync_my_discovered_event_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_first_sync BOOLEAN := FALSE;
  v_notification_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- The marker makes an empty first baseline observable. This prevents the
  -- first later match from being mistaken for historical data when a caller
  -- had no discoverable events at activation time.
  INSERT INTO public.event_discovery_notification_ledger (
    user_id,
    event_id,
    notified_at
  )
  VALUES (v_user_id, NULL, NULL)
  ON CONFLICT (user_id) WHERE event_id IS NULL DO NOTHING
  RETURNING TRUE INTO v_first_sync;

  IF COALESCE(v_first_sync, FALSE) THEN
    INSERT INTO public.event_discovery_notification_ledger (
      user_id,
      event_id,
      notified_at
    )
    SELECT DISTINCT
      v_user_id,
      cp.event_id,
      NULL::TIMESTAMPTZ
    FROM public.call_participants AS cp
    JOIN public.phase39_current_caller_emails() AS caller
      ON caller.email = lower(trim(cp.email))
    WHERE cp.event_id IS NOT NULL
      AND (
        cp.has_confirmed_speech = TRUE
        OR cp.role = 'organizer'
        OR cp.participant_type = 'host'
      )
      AND public.phase38_event_allows_discovery(cp.event_id)
    ON CONFLICT (user_id, event_id) DO NOTHING;

    RETURN 0;
  END IF;

  WITH newly_ledgered AS (
    INSERT INTO public.event_discovery_notification_ledger (
      user_id,
      event_id,
      notified_at
    )
    SELECT DISTINCT
      v_user_id,
      cp.event_id,
      statement_timestamp()
    FROM public.call_participants AS cp
    JOIN public.phase39_current_caller_emails() AS caller
      ON caller.email = lower(trim(cp.email))
    WHERE cp.event_id IS NOT NULL
      AND (
        cp.has_confirmed_speech = TRUE
        OR cp.role = 'organizer'
        OR cp.participant_type = 'host'
      )
      AND public.phase38_event_allows_discovery(cp.event_id)
    ON CONFLICT (user_id, event_id) DO NOTHING
    RETURNING event_id
  ),
  inserted_notifications AS (
    INSERT INTO public.user_notifications (
      user_id,
      type,
      title,
      body,
      metadata,
      created_at
    )
    SELECT
      v_user_id,
      'event_discovered',
      'New event found',
      'A new event connected to your verified email is ready to review.',
      jsonb_build_object(
        'kind', 'event_discovered',
        'event_id', newly_ledgered.event_id,
        'action', 'view_events'
      ),
      statement_timestamp()
    FROM newly_ledgered
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER
  INTO v_notification_count
  FROM inserted_notifications;

  RETURN v_notification_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_discovered_event_notifications()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_discovered_event_notifications()
  TO authenticated, service_role;

-- Alias disconnect is caller-scoped and deliberately accepts only the alias
-- row id. Ownership, active verification, and primary-email protection are
-- all derived under one row lock before any state changes.
CREATE OR REPLACE FUNCTION public.disconnect_my_verified_email_alias(
  p_alias_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_primary_email TEXT;
  v_alias_id UUID;
  v_alias_email TEXT;
BEGIN
  IF v_user_id IS NULL OR p_alias_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT lower(trim(au.email))
  INTO v_primary_email
  FROM auth.users AS au
  WHERE au.id = v_user_id
    AND au.email_confirmed_at IS NOT NULL
    AND NULLIF(trim(au.email), '') IS NOT NULL;

  IF v_primary_email IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT ia.id, lower(trim(ia.value))
  INTO v_alias_id, v_alias_email
  FROM public.identity_aliases AS ia
  JOIN public.identities AS i
    ON i.id = ia.identity_id
  WHERE ia.id = p_alias_id
    AND i.owner_user_id = v_user_id
    AND ia.alias_type = 'email'
    AND ia.verified = TRUE
    AND ia.verified_at IS NOT NULL
    AND NULLIF(trim(ia.value), '') IS NOT NULL
  FOR UPDATE OF ia, i;

  IF v_alias_id IS NULL OR v_alias_email = v_primary_email THEN
    RETURN FALSE;
  END IF;

  UPDATE public.identity_aliases AS ia
  SET verified = FALSE,
      verified_at = NULL
  WHERE ia.id = v_alias_id;

  -- Remove stale actions only when no currently confirmed email still
  -- authorizes the event. The exact-once ledger is intentionally retained.
  DELETE FROM public.user_notifications AS n
  WHERE n.user_id = v_user_id
    AND n.type = 'event_discovered'
    AND n.metadata ->> 'kind' = 'event_discovered'
    AND NOT CASE
      WHEN n.metadata ->> 'event_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN public.phase39_user_can_discover_event((n.metadata ->> 'event_id')::UUID)
      ELSE FALSE
    END;

  RETURN TRUE;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.identity_aliases
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.disconnect_my_verified_email_alias(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_my_verified_email_alias(UUID)
  TO authenticated;

COMMENT ON TABLE public.event_discovery_notification_ledger IS
  'Private exact-once discovery ledger. A null-event marker records silent activation; event rows are retained across disconnect and reconnect.';

COMMENT ON FUNCTION public.sync_my_discovered_event_notifications() IS
  'Caller-pull discovery sync. The first call silently baselines current matches; later first-time user/event matches create one generic in-app notification.';

COMMENT ON FUNCTION public.disconnect_my_verified_email_alias(UUID) IS
  'Atomically deactivates one caller-owned verified non-primary email alias, revokes alias-only discovery, and removes stale discovery notification actions without rewriting participant evidence.';

COMMIT;
