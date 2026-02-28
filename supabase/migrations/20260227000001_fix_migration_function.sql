-- Migration: Fix migrate_fathom_call_to_recording with COALESCE defaults and external_id
-- Purpose: Two known gaps in the original migration function (20260131000008) that must be
--          fixed before running the batch migration:
--          1. NULL title → would violate NOT NULL constraint on recordings.title
--          2. No external_id in source_metadata → breaks Phase 17 deduplication pipeline
--          3. NULL duration → now defaults to 0 (computed from start/end times when available)
-- Phase: 15-01 - Data Migration
-- Date: 2026-02-27

-- =============================================================================
-- MIGRATION FUNCTION: Single Record (FIXED VERSION)
-- =============================================================================
-- Changes from original (20260131000008_migration_function.sql):
--   - title: COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call') - prevents NOT NULL violation
--   - duration: COALESCE(EXTRACT(EPOCH FROM (end - start))::INTEGER, 0) - defaults to 0 not NULL
--   - global_tags: COALESCE(v_call.auto_tags, '{}') - already correct, preserved
--   - source_app: COALESCE(v_call.source_platform, 'fathom') - already correct, preserved
--   - source_metadata: added 'external_id' key (v_call.recording_id::TEXT) as first entry
--     This is the Phase 17 dedup key used by the connector pipeline

CREATE OR REPLACE FUNCTION migrate_fathom_call_to_recording(
  p_recording_id BIGINT,
  p_user_id UUID
)
RETURNS UUID -- Returns new recording UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
  v_new_recording_id UUID;
  v_call RECORD;
BEGIN
  -- Get user's personal bank
  SELECT b.id INTO v_bank_id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  IF v_bank_id IS NULL THEN
    -- User doesn't have a personal bank yet - create one
    -- This handles legacy users who signed up before the Bank/Vault architecture
    INSERT INTO banks (name, type)
    VALUES ('Personal', 'personal')
    RETURNING id INTO v_bank_id;

    INSERT INTO bank_memberships (bank_id, user_id, role)
    VALUES (v_bank_id, p_user_id, 'bank_owner');
  END IF;

  -- Get user's personal vault
  SELECT v.id INTO v_vault_id
  FROM vaults v
  JOIN vault_memberships vm ON vm.vault_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.bank_id = v_bank_id
    AND v.vault_type = 'personal'
  LIMIT 1;

  IF v_vault_id IS NULL THEN
    -- User doesn't have a personal vault yet - create one
    INSERT INTO vaults (bank_id, name, vault_type)
    VALUES (v_bank_id, 'My Calls', 'personal')
    RETURNING id INTO v_vault_id;

    INSERT INTO vault_memberships (vault_id, user_id, role)
    VALUES (v_vault_id, p_user_id, 'vault_owner');
  END IF;

  -- Check if already migrated (idempotency)
  SELECT id INTO v_new_recording_id
  FROM recordings
  WHERE legacy_recording_id = p_recording_id AND bank_id = v_bank_id;

  IF v_new_recording_id IS NOT NULL THEN
    -- Already migrated, return existing ID
    RETURN v_new_recording_id;
  END IF;

  -- Get the fathom_call data
  SELECT * INTO v_call
  FROM fathom_calls
  WHERE recording_id = p_recording_id AND user_id = p_user_id;

  IF v_call IS NULL THEN
    RAISE EXCEPTION 'Call not found: recording_id=%, user_id=%', p_recording_id, p_user_id;
  END IF;

  -- Create recording
  -- FIX 1: COALESCE title so NULL/empty titles become 'Untitled Call' (NOT NULL constraint)
  -- FIX 2: COALESCE duration from time difference, fallback to 0
  -- FIX 3: 'external_id' added to source_metadata for Phase 17 dedup pipeline
  INSERT INTO recordings (
    legacy_recording_id,
    bank_id,
    owner_user_id,
    title,
    audio_url,
    video_url,
    full_transcript,
    summary,
    global_tags,
    source_app,
    source_metadata,
    duration,
    recording_start_time,
    recording_end_time,
    created_at,
    synced_at
  ) VALUES (
    v_call.recording_id,
    v_bank_id,
    p_user_id,
    -- FIX 1: Prevent NOT NULL violation — empty/NULL title becomes 'Untitled Call'
    COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call'),
    v_call.url,       -- Use url as audio_url fallback
    v_call.share_url, -- Use share_url as video_url fallback
    v_call.full_transcript,
    v_call.summary,
    COALESCE(v_call.auto_tags, '{}'),
    COALESCE(v_call.source_platform, 'fathom'),
    -- FIX 3: Add external_id as first key — used by Phase 17 connector pipeline for dedup
    jsonb_build_object(
      'external_id', v_call.recording_id::TEXT,
      'recorded_by_name', v_call.recorded_by_name,
      'recorded_by_email', v_call.recorded_by_email,
      'calendar_invitees', v_call.calendar_invitees,
      'meeting_fingerprint', v_call.meeting_fingerprint,
      'google_calendar_event_id', v_call.google_calendar_event_id,
      'google_drive_file_id', v_call.google_drive_file_id,
      'sentiment_cache', v_call.sentiment_cache,
      'original_metadata', v_call.metadata
    ),
    -- FIX 2: Compute duration from timestamps; default to 0 if either is NULL
    COALESCE(
      EXTRACT(EPOCH FROM (v_call.recording_end_time - v_call.recording_start_time))::INTEGER,
      0
    ),
    v_call.recording_start_time,
    v_call.recording_end_time,
    v_call.created_at,
    v_call.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- Create vault entry in personal vault
  INSERT INTO vault_entries (
    vault_id,
    recording_id,
    local_tags,
    created_at
  ) VALUES (
    v_vault_id,
    v_new_recording_id,
    '{}', -- Start with empty local tags
    v_call.created_at
  );

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION migrate_fathom_call_to_recording IS
  'Migrates a single fathom_call to the recordings + vault_entries model. Idempotent - returns existing ID if already migrated. Fixed version (Phase 15-01): COALESCE title/duration defaults, external_id in source_metadata.';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
