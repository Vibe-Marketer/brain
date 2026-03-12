-- Migration: Fix copy_recording_to_org statement timeout
-- Problem: The function was bulk-copying transcript_chunks including embedding vectors
--          (up to 1536 floats each). For recordings with hundreds of chunks this
--          exceeds the default statement timeout.
-- Fix:     Skip the embedding column when copying chunks (set to NULL). Embeddings
--          are expensive to copy and can be regenerated; the chunk text and metadata
--          are what matter for transcript viewing. Also set a generous local timeout.
-- Date: 2026-03-12

CREATE OR REPLACE FUNCTION public.copy_recording_to_org(
  p_recording_id        UUID,
  p_target_org_id       UUID,
  p_target_workspace_id UUID,
  p_delete_original     BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id           UUID;
  v_source              RECORD;
  v_new_recording_id    UUID;
  v_workspace_org_id    UUID;
  v_delete_result       JSONB;
BEGIN
  -- Give this function more time than the default statement timeout.
  -- Copying a recording with many transcript chunks can take several seconds.
  SET LOCAL statement_timeout = '30000';  -- 30 seconds

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

  IF NOT FOUND THEN
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
  -- Validate that target workspace belongs to target org
  -- ---------------------------------------------------------------
  SELECT organization_id INTO v_workspace_org_id
  FROM workspaces
  WHERE id = p_target_workspace_id;

  IF v_workspace_org_id IS NULL THEN
    RAISE EXCEPTION 'Target workspace not found: %', p_target_workspace_id;
  END IF;

  IF v_workspace_org_id <> p_target_org_id THEN
    RAISE EXCEPTION 'Target workspace does not belong to target organization';
  END IF;

  -- ---------------------------------------------------------------
  -- SECURITY: caller must be member of target workspace
  -- ---------------------------------------------------------------
  IF NOT is_workspace_member(p_target_workspace_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of target workspace';
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
    COALESCE(v_source.source_metadata, '{}'::jsonb) || jsonb_build_object(
      'copied_from_recording_id', p_recording_id,
      'copied_from_org_id',       v_source.organization_id,
      'copied_at',                NOW()::TEXT,
      'copied_by',                v_caller_id
    ),
    v_source.duration,
    v_source.recording_start_time,
    v_source.recording_end_time,
    NULL,           -- source_call_id NULL to avoid dedup constraint collision
    NOW(),
    v_source.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- ---------------------------------------------------------------
  -- Copy transcript_chunks WITHOUT the embedding column.
  -- Embeddings are large vectors (up to 1536 floats each); copying them
  -- for every chunk in bulk was the cause of the statement timeout.
  -- They can be re-generated async if semantic search is needed in the target org.
  -- recording_id (BIGINT) is intentionally omitted (defaults to NULL).
  -- fts is GENERATED ALWAYS AS — omit from INSERT; Postgres recomputes it.
  -- ---------------------------------------------------------------
  INSERT INTO transcript_chunks (
    canonical_recording_id,
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
    -- embedding intentionally omitted — copied chunks start with NULL embedding
    created_at
  )
  SELECT
    v_new_recording_id,
    v_caller_id,
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
    NOW()
  FROM transcript_chunks tc
  WHERE tc.canonical_recording_id = p_recording_id;

  -- ---------------------------------------------------------------
  -- Create workspace_entry in the specified target workspace.
  -- ---------------------------------------------------------------
  INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
  VALUES (p_target_workspace_id, v_new_recording_id, NOW())
  ON CONFLICT (workspace_id, recording_id) DO NOTHING;

  -- ---------------------------------------------------------------
  -- Optionally delete the original recording.
  -- ---------------------------------------------------------------
  IF p_delete_original THEN
    IF v_source.owner_user_id <> v_caller_id THEN
      RAISE EXCEPTION 'Cannot delete original: caller is not the recording owner';
    END IF;

    v_delete_result := delete_recording(p_recording_id);

    IF v_delete_result ? 'error' THEN
      RAISE EXCEPTION 'Failed to delete original recording: %', v_delete_result->>'error';
    END IF;
  END IF;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.copy_recording_to_org(UUID, UUID, UUID, BOOLEAN) IS
  'Copies a recording into a specific workspace in a target org. '
  'Copies transcript chunks WITHOUT embeddings (avoids statement timeout on large recordings). '
  'Caller must be a member of both source and target orgs, and of the target workspace. '
  'When p_delete_original=true the source recording is deleted (caller must own it). '
  'Returns the new recording UUID.';
