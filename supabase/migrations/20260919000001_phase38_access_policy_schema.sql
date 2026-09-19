-- Phase 38: recording access policy storage and lifecycle ledgers.
-- Additive only. Authorization and RPCs are installed by the following migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- Policy values and default snapshots
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_recording_access_level TEXT NOT NULL DEFAULT 'private';

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_default_recording_access_level_check
  CHECK (default_recording_access_level IN (
    'private', 'attendees', 'invitees', 'organization', 'link', 'public'
  ));

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS access_level TEXT,
  ADD COLUMN IF NOT EXISTS access_policy_origin TEXT;

-- Existing recordings remain private unless an already-existing access path
-- (workspace/team/admin/share) authorizes the caller. Their value is a snapshot
-- and never follows a later account-default change.
UPDATE public.recordings
SET
  access_level = COALESCE(access_level, 'private'),
  access_policy_origin = COALESCE(access_policy_origin, 'default')
WHERE access_level IS NULL OR access_policy_origin IS NULL;

ALTER TABLE public.recordings
  ALTER COLUMN access_level SET DEFAULT 'private',
  ALTER COLUMN access_level SET NOT NULL,
  ALTER COLUMN access_policy_origin SET DEFAULT 'default',
  ALTER COLUMN access_policy_origin SET NOT NULL;

ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_access_level_check
  CHECK (access_level IN (
    'private', 'attendees', 'invitees', 'organization', 'link', 'public'
  )),
  ADD CONSTRAINT recordings_access_policy_origin_check
  CHECK (access_policy_origin IN ('default', 'custom'));

CREATE OR REPLACE FUNCTION public.snapshot_recording_access_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A caller must affirmatively mark a value custom to bypass the account
  -- snapshot. This covers connectors, paste/MCP ingest, direct SQL, and copies.
  IF NEW.access_policy_origin IS NULL OR NEW.access_policy_origin = 'default' THEN
    SELECT COALESCE(us.default_recording_access_level, 'private')
      INTO NEW.access_level
    FROM public.user_settings AS us
    WHERE us.user_id = NEW.owner_user_id;

    NEW.access_level := COALESCE(NEW.access_level, 'private');
    NEW.access_policy_origin := 'default';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.snapshot_recording_access_policy() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_recording_access_policy() TO service_role;

CREATE TRIGGER snapshot_recording_access_policy_before_insert
  BEFORE INSERT ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_recording_access_policy();

COMMENT ON COLUMN public.user_settings.default_recording_access_level IS
  'Account default snapshotted onto future recordings. Changes never rewrite existing recordings.';
COMMENT ON COLUMN public.recordings.access_level IS
  'Single recording policy: private, attendees, invitees, organization, link, or public.';
COMMENT ON COLUMN public.recordings.access_policy_origin IS
  'default when snapshotted from account settings; custom after an owner override.';

-- ---------------------------------------------------------------------------
-- Explicit participant-evidence normalization
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_recording_participant_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Transcript evidence is affirmative only for an explicitly identified
  -- speaker. Both exact source labels are already used by repository writers.
  IF NEW.participant_type = 'speaker'
     AND NEW.sources && ARRAY['transcript', 'transcript_speaker']::TEXT[] THEN
    NEW.role := 'speaker';
    NEW.has_confirmed_speech := TRUE;

  -- recorded_by/host is affirmative organizer evidence, but does not imply
  -- that the host spoke unless transcript evidence also says so.
  ELSIF NEW.participant_type = 'host'
        OR NEW.sources @> ARRAY['recorded_by']::TEXT[] THEN
    NEW.role := 'organizer';
    NEW.has_confirmed_speech := COALESCE(NEW.has_confirmed_speech, FALSE);

  -- Calendar evidence by itself proves invitation, not attendance.
  ELSIF NEW.sources @> ARRAY['calendar_invitees']::TEXT[]
        AND NOT (NEW.sources && ARRAY['transcript', 'transcript_speaker', 'recorded_by']::TEXT[]) THEN
    NEW.role := 'invitee';
    NEW.has_confirmed_speech := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_recording_participant_evidence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_recording_participant_evidence() TO service_role;

CREATE TRIGGER normalize_recording_participant_evidence_before_write
  BEFORE INSERT OR UPDATE OF participant_type, sources, role, has_confirmed_speech
  ON public.call_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_recording_participant_evidence();

UPDATE public.call_participants
SET
  role = CASE
    WHEN participant_type = 'speaker'
         AND sources && ARRAY['transcript', 'transcript_speaker']::TEXT[]
      THEN 'speaker'
    WHEN participant_type = 'host' OR sources @> ARRAY['recorded_by']::TEXT[]
      THEN 'organizer'
    WHEN sources @> ARRAY['calendar_invitees']::TEXT[]
         AND NOT (sources && ARRAY['transcript', 'transcript_speaker', 'recorded_by']::TEXT[])
      THEN 'invitee'
    ELSE role
  END,
  has_confirmed_speech = CASE
    WHEN participant_type = 'speaker'
         AND sources && ARRAY['transcript', 'transcript_speaker']::TEXT[]
      THEN TRUE
    WHEN participant_type = 'host' OR sources @> ARRAY['recorded_by']::TEXT[]
      THEN COALESCE(has_confirmed_speech, FALSE)
    WHEN sources @> ARRAY['calendar_invitees']::TEXT[]
         AND NOT (sources && ARRAY['transcript', 'transcript_speaker', 'recorded_by']::TEXT[])
      THEN FALSE
    ELSE has_confirmed_speech
  END
WHERE
  (participant_type = 'speaker' AND sources && ARRAY['transcript', 'transcript_speaker']::TEXT[])
  OR participant_type = 'host'
  OR sources @> ARRAY['recorded_by']::TEXT[]
  OR sources @> ARRAY['calendar_invitees']::TEXT[];

-- ---------------------------------------------------------------------------
-- Request, grant, immutable audit, and durable email-delivery storage
-- ---------------------------------------------------------------------------

CREATE TABLE public.recording_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_verified_email TEXT NOT NULL,
  requester_name TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (cooldown_until IS NULL OR denied_at IS NOT NULL),
  CHECK (cooldown_until IS NULL OR cooldown_until = denied_at + INTERVAL '30 days')
);

CREATE UNIQUE INDEX recording_access_requests_one_pending
  ON public.recording_access_requests(recording_id, requester_user_id)
  WHERE status = 'pending';
CREATE INDEX recording_access_requests_recording_created
  ON public.recording_access_requests(recording_id, created_at DESC);
CREATE INDEX recording_access_requests_requester_created
  ON public.recording_access_requests(requester_user_id, created_at DESC);
CREATE INDEX recording_access_requests_cooldown
  ON public.recording_access_requests(recording_id, requester_user_id, cooldown_until DESC)
  WHERE status = 'denied';

CREATE TABLE public.recording_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  grantee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_request_id UUID REFERENCES public.recording_access_requests(id) ON DELETE SET NULL,
  granted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (revoked_at IS NOT NULL OR revoked_by_user_id IS NULL)
);

CREATE UNIQUE INDEX recording_access_grants_one_active
  ON public.recording_access_grants(recording_id, grantee_user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX recording_access_grants_recording_granted
  ON public.recording_access_grants(recording_id, granted_at DESC);
CREATE INDEX recording_access_grants_grantee_active
  ON public.recording_access_grants(grantee_user_id, recording_id)
  WHERE revoked_at IS NULL;

CREATE TABLE public.recording_access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES public.recordings(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.recording_access_requests(id) ON DELETE SET NULL,
  grant_id UUID REFERENCES public.recording_access_grants(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'requested', 'approved', 'denied', 'revoked', 'policy_set', 'policy_reset', 'default_set'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX recording_access_audit_recording_created
  ON public.recording_access_audit_log(recording_id, created_at DESC);
CREATE INDEX recording_access_audit_request_created
  ON public.recording_access_audit_log(request_id, created_at DESC);

CREATE TABLE public.recording_access_email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES public.recordings(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.recording_access_requests(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  delivery_kind TEXT NOT NULL DEFAULT 'owner_request_review'
    CHECK (delivery_kind IN ('owner_request_review', 'requester_decision')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  next_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX recording_access_email_outbox_one_request_review
  ON public.recording_access_email_outbox(request_id, delivery_kind)
  WHERE request_id IS NOT NULL;
CREATE INDEX recording_access_email_outbox_delivery_queue
  ON public.recording_access_email_outbox(status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

COMMENT ON TABLE public.recording_access_requests IS
  'Owner-reviewed recording access requests. No free-form requester message or denial reason is stored.';
COMMENT ON TABLE public.recording_access_grants IS
  'Recording grants remain active until the owner records a revocation timestamp.';
COMMENT ON TABLE public.recording_access_audit_log IS
  'Append-only access decision history. Request/grant references use SET NULL so history survives lifecycle cleanup.';
COMMENT ON TABLE public.recording_access_email_outbox IS
  'Durable, idempotent email-delivery work. Request references use SET NULL so delivery history is not cascade-deleted.';

COMMIT;
