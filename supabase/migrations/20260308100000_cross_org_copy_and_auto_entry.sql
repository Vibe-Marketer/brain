-- Migration: Cross-org copy RPC + default workspace auto-entry trigger
-- Purpose: (1) A proper copy_recording_to_organization RPC that verifies membership
--          in BOTH source and target orgs before copying.
--          (2) A trigger that auto-creates workspace_entries in the org's HOME
--          workspace whenever a recording is inserted.
-- Author: Claude (issue #58)
-- Date: 2026-03-08

-- ============================================================================
-- 1. CROSS-ORG COPY RPC: copy_recording_to_organization
-- ============================================================================
-- Copies a single recording (and its transcript_chunks) into a target org.
-- SECURITY: caller must be member of BOTH source and target organizations.
-- Returns the new recording's UUID.

CREATE OR REPLACE FUNCTION public.copy_recording_to_organization(
  p_recording_id UUID,
  p_target_org_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_source RECORD;
  v_new_recording_id UUID;
  v_target_home_workspace_id UUID;
  v_chunk RECORD;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ---------------------------------------------------------------
  -- Fetch source recording
  -- ---------------------------------------------------------------
  SELECT * INTO v_source
  FROM recordings
  WHERE id = p_recording_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Recording not found: %', p_recording_id;
  END IF;

  -- ---------------------------------------------------------------
  -- SECURITY: caller must be member of SOURCE organization
  -- ---------------------------------------------------------------
  IF NOT is_organization_member(v_source.organization_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of source organization';
  END IF;

  -- ---------------------------------------------------------------
  -- SECURITY: caller must be member of TARGET organization
  -- ---------------------------------------------------------------
  IF NOT is_organization_member(p_target_org_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of target organization';
  END IF;

  -- ---------------------------------------------------------------
  -- Prevent copying to the same organization
  -- ---------------------------------------------------------------
  IF v_source.organization_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organization are the same';
  END IF;

  -- ---------------------------------------------------------------
  -- Look up target org's HOME workspace
  -- ---------------------------------------------------------------
  SELECT id INTO v_target_home_workspace_id
  FROM workspaces
  WHERE organization_id = p_target_org_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_target_home_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Target organization has no HOME workspace';
  END IF;

  -- ---------------------------------------------------------------
  -- Create recording copy in target org
  -- ---------------------------------------------------------------
  INSERT INTO recordings (
    organization_id,
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
    source_call_id,
    created_at,
    synced_at
  )
  VALUES (
    p_target_org_id,
    v_caller_id,
    v_source.title,
    v_source.audio_url,
    v_source.video_url,
    v_source.full_transcript,
    v_source.summary,
    v_source.global_tags,
    v_source.source_app,
    -- Merge provenance into source_metadata
    COALESCE(v_source.source_metadata, '{}'::jsonb) || jsonb_build_object(
      'copied_from_recording_id', p_recording_id,
      'copied_from_org_id', v_source.organization_id,
      'copied_at', NOW()::TEXT,
      'copied_by', v_caller_id
    ),
    v_source.duration,
    v_source.recording_start_time,
    v_source.recording_end_time,
    NULL, -- source_call_id is NULL to avoid dedup constraint collision
    NOW(),
    v_source.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- ---------------------------------------------------------------
  -- Copy transcript_chunks (only those linked via canonical_recording_id)
  -- ---------------------------------------------------------------
  INSERT INTO transcript_chunks (
    canonical_recording_id,
    recording_id,
    user_id,
    chunk_text,
    chunk_index,
    speaker_name,
    speaker_email,
    call_date,
    call_title,
    call_category,
    topics,
    sentiment,
    intent_signals,
    user_tags,
    entities,
    source_platform,
    embedding,
    fts,
    created_at
  )
  SELECT
    v_new_recording_id,
    tc.recording_id,          -- keep legacy BIGINT for backward compat
    v_caller_id,              -- new owner
    tc.chunk_text,
    tc.chunk_index,
    tc.speaker_name,
    tc.speaker_email,
    tc.call_date,
    tc.call_title,
    tc.call_category,
    tc.topics,
    tc.sentiment,
    tc.intent_signals,
    tc.user_tags,
    tc.entities,
    tc.source_platform,
    tc.embedding,
    tc.fts,
    NOW()
  FROM transcript_chunks tc
  WHERE tc.canonical_recording_id = p_recording_id;

  -- ---------------------------------------------------------------
  -- Create workspace_entry in target org's HOME workspace
  -- (The auto-entry trigger would also do this, but being explicit
  --  ensures the entry exists even if the trigger is ever removed.)
  -- ---------------------------------------------------------------
  INSERT INTO workspace_entries (
    workspace_id,
    recording_id,
    created_at
  )
  VALUES (
    v_target_home_workspace_id,
    v_new_recording_id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.copy_recording_to_organization(UUID, UUID) IS
  'Copies a recording (and transcript_chunks) to a target organization. '
  'Caller must be a member of BOTH source and target orgs. '
  'New recording is placed in the target org HOME workspace.';


-- ============================================================================
-- 2. DEFAULT WORKSPACE AUTO-ENTRY TRIGGER
-- ============================================================================
-- Whenever a recording is INSERTed, auto-create a workspace_entry in the
-- org's HOME workspace (is_home = TRUE). Idempotent: skips if entry exists.

CREATE OR REPLACE FUNCTION public.auto_create_default_workspace_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_workspace_id UUID;
BEGIN
  -- Find the HOME workspace for the recording's organization
  SELECT id INTO v_home_workspace_id
  FROM workspaces
  WHERE organization_id = NEW.organization_id
    AND is_home = TRUE
  LIMIT 1;

  -- If no HOME workspace exists, silently skip (defensive)
  IF v_home_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert workspace_entry; skip if already exists
  INSERT INTO workspace_entries (
    workspace_id,
    recording_id,
    created_at
  )
  VALUES (
    v_home_workspace_id,
    NEW.id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS tr_auto_create_default_workspace_entry ON recordings;

CREATE TRIGGER tr_auto_create_default_workspace_entry
AFTER INSERT ON recordings
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_default_workspace_entry();

COMMENT ON FUNCTION public.auto_create_default_workspace_entry() IS
  'Trigger function: auto-creates a workspace_entry in the org HOME workspace '
  'for every newly inserted recording. Idempotent (ON CONFLICT DO NOTHING).';

-- ============================================================================
-- 3. DROP THE OLD BATCH COPY RPC (superseded)
-- ============================================================================
-- The old copy_recordings_to_organization had weaker permission checks
-- (only checked target org membership, not source). Replace it.

DROP FUNCTION IF EXISTS public.copy_recordings_to_organization(UUID[], UUID, BOOLEAN);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
