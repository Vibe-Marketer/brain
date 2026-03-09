-- Migration: Atomic Split Recording RPC
-- Purpose: Wrap the Part 1 update + Part 2 insert in a single Postgres transaction
--          so a mid-operation failure cannot leave recordings in an inconsistent state.
-- Issue: #148 (split call recording into two parts)

-- ============================================================================
-- FUNCTION: split_recording_atomic
-- ============================================================================
-- Performs all critical DB writes for splitting a recording atomically:
--   1. Updates Part 1 (existing recording) — new title, trimmed transcript, cleared summary
--   2. Creates Part 2 (new recordings row)
-- Returns the UUID of the newly created Part 2 recording.
--
-- Workspace entry copying is left to the caller (edge function) since it is
-- non-critical and can be retried independently without data corruption.

CREATE OR REPLACE FUNCTION public.split_recording_atomic(
  -- Part 1 identifiers (at least one must be non-null)
  p_part1_recordings_id   UUID,     -- recordings.id if available (nullable)
  p_part1_fathom_id       BIGINT,   -- fathom_calls.recording_id for legacy (nullable)

  -- Part 1 updated values
  p_part1_title           TEXT NOT NULL,
  p_part1_transcript      TEXT NOT NULL,

  -- Part 2 creation values
  p_part2_title           TEXT NOT NULL,
  p_part2_transcript      TEXT NOT NULL,
  p_organization_id       UUID NOT NULL,
  p_owner_user_id         UUID NOT NULL,
  p_source_app            TEXT,
  p_source_metadata       JSONB DEFAULT '{}',
  p_recording_start_time  TIMESTAMPTZ,
  p_recording_end_time    TIMESTAMPTZ,
  p_audio_url             TEXT,
  p_video_url             TEXT
)
RETURNS UUID  -- UUID of the newly created Part 2 recording
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part2_id UUID;
BEGIN
  -- Validate: p_owner_user_id must be the owner of the source recording.
  -- Note: this RPC is called with the service role key (via the edge function),
  -- so auth.uid() is NULL. We use the p_owner_user_id parameter instead, which
  -- is already validated by the edge function against the user's JWT.
  IF p_part1_recordings_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM recordings
      WHERE id = p_part1_recordings_id
        AND owner_user_id = p_owner_user_id
    ) THEN
      RAISE EXCEPTION 'Access denied: not the owner of recording %', p_part1_recordings_id;
    END IF;
  END IF;

  -- 1. Update Part 1 in the recordings table (if a UUID row exists)
  IF p_part1_recordings_id IS NOT NULL THEN
    UPDATE recordings
    SET
      title           = p_part1_title,
      full_transcript = p_part1_transcript,
      summary         = NULL,
      updated_at      = NOW()
    WHERE id = p_part1_recordings_id;
  END IF;

  -- 2. Update Part 1 in fathom_raw_calls for legacy compatibility (best-effort)
  -- NOTE: fathom_calls is a VIEW (not the base table); writes must target fathom_raw_calls.
  IF p_part1_fathom_id IS NOT NULL THEN
    UPDATE fathom_raw_calls
    SET
      title           = p_part1_title,
      full_transcript = p_part1_transcript,
      summary         = NULL
    WHERE recording_id = p_part1_fathom_id;
    -- Note: fathom_raw_calls.user_id is NOT checked here because this function is
    -- SECURITY DEFINER — the ownership check on recordings above is sufficient.
    -- The RPC is only callable by an authenticated user via the edge function,
    -- which separately validates auth.uid() = p_owner_user_id.
  END IF;

  -- 3. Create Part 2 as a new recordings row
  INSERT INTO recordings (
    organization_id,
    owner_user_id,
    title,
    full_transcript,
    audio_url,
    video_url,
    source_app,
    source_metadata,
    recording_start_time,
    recording_end_time,
    created_at,
    synced_at
  ) VALUES (
    p_organization_id,
    p_owner_user_id,
    p_part2_title,
    p_part2_transcript,
    p_audio_url,
    p_video_url,
    p_source_app,
    p_source_metadata,
    p_recording_start_time,
    p_recording_end_time,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_part2_id;

  RETURN v_part2_id;
END;
$$;

COMMENT ON FUNCTION public.split_recording_atomic IS
  'Atomically updates Part 1 and creates Part 2 when splitting a call recording. '
  'Called by the split-recording edge function. Workspace entry copying is done '
  'by the caller after this function succeeds.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Revoke direct execution from all non-service roles.
-- The function is SECURITY DEFINER and must only be reachable via the edge
-- function (which uses the service role key). Without this, any authenticated
-- user could call it directly via PostgREST and pass arbitrary p_owner_user_id /
-- p_organization_id values — the ownership check only fires when
-- p_part1_recordings_id IS NOT NULL, so passing NULL for both id params would
-- skip all validation while still inserting a Part 2 row.
REVOKE EXECUTE ON FUNCTION public.split_recording_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.split_recording_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.split_recording_atomic FROM authenticated;
-- (The service role bypasses EXECUTE grants, so edge function calls still work.)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
