-- Migration: Create functions to migrate fathom_calls to recordings + vault_entries
-- Purpose: Provide idempotent migration functions for the Bank/Vault architecture transition
-- Phase: 09-06 - Bank/Vault Architecture
-- Date: 2026-01-31

-- =============================================================================
-- MIGRATION FUNCTION: Single Record
-- =============================================================================
-- Per CONTEXT.md: Each user's existing calls become VaultEntries in their Personal Vault
-- This function:
--   1. Creates bank/vault if user doesn't have one (handles legacy users)
--   2. Is idempotent (safe to re-run - returns existing ID if already migrated)
--   3. Maps fathom_calls columns to recordings columns
--   4. Creates vault_entry in personal vault

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
  -- Note: fathom_calls doesn't have audio_url, video_url, or duration columns
  -- We use url/share_url for reference, metadata for platform-specific data
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
    v_call.title,
    v_call.url,  -- Use url as audio_url fallback
    v_call.share_url,  -- Use share_url as video_url fallback
    v_call.full_transcript,
    v_call.summary,
    COALESCE(v_call.auto_tags, '{}'),
    COALESCE(v_call.source_platform, 'fathom'),
    -- Build source_metadata from relevant fathom_calls columns
    jsonb_build_object(
      'recorded_by_name', v_call.recorded_by_name,
      'recorded_by_email', v_call.recorded_by_email,
      'calendar_invitees', v_call.calendar_invitees,
      'meeting_fingerprint', v_call.meeting_fingerprint,
      'google_calendar_event_id', v_call.google_calendar_event_id,
      'google_drive_file_id', v_call.google_drive_file_id,
      'sentiment_cache', v_call.sentiment_cache,
      'original_metadata', v_call.metadata
    ),
    NULL,  -- duration not available in fathom_calls
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
  'Migrates a single fathom_call to the recordings + vault_entries model. Idempotent - returns existing ID if already migrated.';

-- =============================================================================
-- BATCH MIGRATION FUNCTION
-- =============================================================================
-- For background processing - processes N calls at a time
-- Returns count of successfully migrated and error count

CREATE OR REPLACE FUNCTION migrate_batch_fathom_calls(
  p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE(migrated_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_errors INTEGER := 0;
  v_call RECORD;
BEGIN
  -- Get batch of calls not yet migrated
  -- We check for existence in recordings table using legacy_recording_id
  FOR v_call IN
    SELECT fc.recording_id, fc.user_id
    FROM fathom_calls fc
    WHERE NOT EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.legacy_recording_id = fc.recording_id
    )
    LIMIT p_batch_size
  LOOP
    BEGIN
      PERFORM migrate_fathom_call_to_recording(v_call.recording_id, v_call.user_id);
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      -- Log error but continue with next record
      RAISE WARNING 'Migration failed for recording_id=%, user_id=%: %', 
        v_call.recording_id, v_call.user_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_errors;
END;
$$;

COMMENT ON FUNCTION migrate_batch_fathom_calls IS 
  'Processes a batch of fathom_calls for migration. Returns count of successful migrations and errors.';

-- =============================================================================
-- MIGRATION PROGRESS FUNCTION
-- =============================================================================
-- Helper function to check migration progress

CREATE OR REPLACE FUNCTION get_migration_progress()
RETURNS TABLE(
  total_fathom_calls BIGINT,
  migrated_recordings BIGINT,
  remaining BIGINT,
  percent_complete NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT 
      (SELECT COUNT(*) FROM fathom_calls) AS total,
      (SELECT COUNT(*) FROM recordings WHERE legacy_recording_id IS NOT NULL) AS migrated
  )
  SELECT 
    total,
    migrated,
    total - migrated AS remaining,
    CASE WHEN total > 0 
      THEN ROUND((migrated::NUMERIC / total::NUMERIC) * 100, 2)
      ELSE 100
    END AS percent_complete
  FROM stats;
$$;

COMMENT ON FUNCTION get_migration_progress IS 
  'Returns current migration progress statistics.';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
