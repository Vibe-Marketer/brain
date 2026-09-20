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

COMMENT ON TABLE public.event_discovery_notification_ledger IS
  'Private exact-once discovery ledger. A null-event marker records silent activation; event rows are retained across disconnect and reconnect.';

COMMENT ON FUNCTION public.sync_my_discovered_event_notifications() IS
  'Caller-pull discovery sync. The first call silently baselines current matches; later first-time user/event matches create one generic in-app notification.';

COMMIT;
