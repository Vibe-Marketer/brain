-- Phase 39: participation claim invitations and atomic claim lifecycle
--
-- This ledger is private service state. Browser callers can reach only the
-- narrow caller-derived RPCs below; no caller supplies an owner or email.

BEGIN;

CREATE TABLE public.participation_claim_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.call_participants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL CHECK (
    invited_email = lower(trim(invited_email))
    AND invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  state TEXT NOT NULL DEFAULT 'sent' CHECK (
    state IN ('sent', 'claimed', 'expired', 'revoked', 'superseded')
  ),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (pg_catalog.now() + INTERVAL '7 days'),
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  reminder_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_scheduled_for TIMESTAMPTZ,
  reminder_provider_id TEXT,
  reminder_sent_at TIMESTAMPTZ,
  reminder_cancellation_requested_at TIMESTAMPTZ,
  reminder_cancelled_at TIMESTAMPTZ,
  reminder_cancellation_error TEXT,
  delivery_provider_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    delivery_status IN ('pending', 'sent', 'failed')
  ),
  delivery_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT participation_claim_expiry_after_send CHECK (expires_at > sent_at),
  CONSTRAINT participation_claim_terminal_state CHECK (
    (state = 'claimed' AND claimed_at IS NOT NULL AND claimed_by_user_id IS NOT NULL)
    OR (state = 'superseded' AND superseded_at IS NOT NULL)
    OR (state = 'revoked' AND revoked_at IS NOT NULL)
    OR state IN ('sent', 'expired')
  ),
  CONSTRAINT participation_claim_reminder_before_expiry CHECK (
    reminder_scheduled_for IS NULL OR reminder_scheduled_for < expires_at
  )
);

CREATE UNIQUE INDEX participation_claim_one_live_participant_idx
  ON public.participation_claim_invitations (participant_id)
  WHERE state = 'sent';

CREATE INDEX participation_claim_inviter_participant_idx
  ON public.participation_claim_invitations (inviter_user_id, participant_id, created_at DESC);

CREATE INDEX participation_claim_live_email_idx
  ON public.participation_claim_invitations (invited_email, created_at DESC)
  WHERE state = 'sent';

ALTER TABLE public.participation_claim_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_claim_invitations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.participation_claim_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participation_claim_invitations TO service_role;

CREATE POLICY participation_claim_service_only
  ON public.participation_claim_invitations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION public.create_or_rotate_participation_claim(
  p_participant_id UUID,
  p_token_hash TEXT,
  p_send_one_reminder BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  invitation_id UUID,
  invited_email TEXT,
  expires_at TIMESTAMPTZ,
  reminder_opt_in BOOLEAN,
  rotated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_recording_id UUID;
  v_event_id UUID;
  v_owner UUID;
  v_email TEXT;
  v_primary_email TEXT;
  v_existing public.participation_claim_invitations%ROWTYPE;
  v_created public.participation_claim_invitations%ROWTYPE;
  v_rotated BOOLEAN := FALSE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'participation_claim_not_available' USING ERRCODE = 'P0001';
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'participation_claim_not_available' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    cp.recording_id,
    cp.event_id,
    r.owner_user_id,
    lower(trim(cp.email)),
    lower(trim(au.email))
  INTO v_recording_id, v_event_id, v_owner, v_email, v_primary_email
  FROM public.call_participants AS cp
  JOIN public.recordings AS r ON r.id = cp.recording_id
  LEFT JOIN auth.users AS au ON au.id = v_caller
  WHERE cp.id = p_participant_id
    AND r.owner_user_id = v_caller
    AND cp.event_id IS NOT NULL
    AND NULLIF(trim(cp.email), '') IS NOT NULL
    AND (
      cp.has_confirmed_speech = TRUE
      OR cp.role = 'organizer'
      OR cp.participant_type = 'host'
    )
  FOR UPDATE OF cp;

  IF v_recording_id IS NULL
    OR v_event_id IS NULL
    OR v_owner IS DISTINCT FROM v_caller
    OR v_email IS NULL
    OR v_email = v_primary_email
    OR EXISTS (
      SELECT 1
      FROM public.identity_aliases AS ia
      WHERE ia.alias_type = 'email'
        AND lower(trim(ia.value)) = v_email
        AND ia.verified = TRUE
        AND ia.verified_at IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'participation_claim_not_available' USING ERRCODE = 'P0001';
  END IF;

  SELECT pci.*
  INTO v_existing
  FROM public.participation_claim_invitations AS pci
  WHERE pci.participant_id = p_participant_id
    AND pci.state = 'sent'
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.sent_at > pg_catalog.now() - INTERVAL '7 days' THEN
      RAISE EXCEPTION 'participation_claim_resend_not_available' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.participation_claim_invitations AS pci
    SET state = 'superseded',
        superseded_at = pg_catalog.now(),
        reminder_cancellation_requested_at = CASE
          WHEN pci.reminder_provider_id IS NOT NULL THEN pg_catalog.now()
          ELSE pci.reminder_cancellation_requested_at
        END,
        reminder_cancelled_at = CASE
          WHEN pci.reminder_provider_id IS NULL THEN pg_catalog.now()
          ELSE pci.reminder_cancelled_at
        END,
        updated_at = pg_catalog.now()
    WHERE pci.id = v_existing.id;
    v_rotated := TRUE;
  END IF;

  INSERT INTO public.participation_claim_invitations (
    recording_id,
    participant_id,
    event_id,
    inviter_user_id,
    invited_email,
    token_hash,
    sent_at,
    expires_at,
    reminder_opt_in
  ) VALUES (
    v_recording_id,
    p_participant_id,
    v_event_id,
    v_caller,
    v_email,
    p_token_hash,
    pg_catalog.now(),
    pg_catalog.now() + INTERVAL '7 days',
    COALESCE(p_send_one_reminder, FALSE)
  )
  RETURNING * INTO v_created;

  RETURN QUERY SELECT
    v_created.id,
    v_created.invited_email,
    v_created.expires_at,
    v_created.reminder_opt_in,
    v_rotated;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_participation_claim_invitation_status(
  p_participant_id UUID
)
RETURNS TABLE (
  state TEXT,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  reminder_opt_in BOOLEAN,
  reminder_scheduled_for TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pci.state,
    pci.sent_at,
    pci.expires_at,
    pci.claimed_at,
    pci.reminder_opt_in,
    pci.reminder_scheduled_for,
    pci.reminder_sent_at
  FROM public.participation_claim_invitations AS pci
  JOIN public.recordings AS r ON r.id = pci.recording_id
  WHERE pci.participant_id = p_participant_id
    AND r.owner_user_id = auth.uid()
  ORDER BY pci.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.cancel_participation_claim_reminder(
  p_invitation_id UUID,
  p_cancelled BOOLEAN,
  p_failure_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'participation_claim_not_available' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.participation_claim_invitations AS pci
  SET reminder_cancellation_requested_at = COALESCE(pci.reminder_cancellation_requested_at, pg_catalog.now()),
      reminder_cancelled_at = CASE WHEN p_cancelled THEN pg_catalog.now() ELSE pci.reminder_cancelled_at END,
      reminder_cancellation_error = CASE WHEN p_cancelled THEN NULL ELSE left(COALESCE(p_failure_code, 'provider_error'), 100) END,
      updated_at = pg_catalog.now()
  WHERE pci.id = p_invitation_id;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_or_rotate_participation_claim(UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_or_rotate_participation_claim(UUID, TEXT, BOOLEAN)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_participation_claim_invitation_status(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_participation_claim_invitation_status(UUID)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_participation_claim_reminder(UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_participation_claim_reminder(UUID, BOOLEAN, TEXT)
  TO service_role;

COMMENT ON TABLE public.participation_claim_invitations IS
  'Private service-managed participation claim state. Stores only SHA-256 token digests; browser roles have no table privileges.';

COMMIT;
