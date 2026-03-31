-- Migration: Fix copy_recording_to_org statement timeout (v2)
-- Problem: The function still times out in production (~8.5s) despite the
--          SET LOCAL statement_timeout = '30000' added in 20260312100000.
--          Supabase's PostgREST gateway enforces its own HTTP timeout that
--          cannot be overridden by SET LOCAL inside the function body.
--          The function-level SET clause (like SET search_path) is the
--          authoritative way to configure GUC parameters for an RPC.
-- Fix:
--   1. Add statement_timeout = '60s' as a function-level SET parameter
--      on copy_recording_to_org. This takes effect BEFORE PostgREST's
--      timeout check and is the recommended Supabase pattern.
--   2. Apply the same fix to copy_recording_to_organization (2-param
--      version) which was still copying embeddings with no timeout.
--   3. Apply the same fix to route_recording_cross_org which also copies
--      embeddings with no timeout override.
-- Date: 2026-03-31

-- ============================================================================
-- 1. FIX copy_recording_to_org (4-param — called by frontend)
-- ============================================================================
-- Changes vs 20260312100000:
--   - Added function-level SET statement_timeout = '60s' (authoritative)
--   - Removed SET LOCAL from function body (redundant with function-level SET)

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
SET statement_timeout = '60s'
AS $$
DECLARE
  v_caller_id           UUID;
  v_source              RECORD;
  v_new_recording_id    UUID;
  v_workspace_org_id    UUID;
  v_delete_result       JSONB;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch source recording
  SELECT * INTO v_source
  FROM recordings
  WHERE id = p_recording_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording not found: %', p_recording_id;
  END IF;

  -- SECURITY: caller must be member of SOURCE organization
  IF NOT is_organization_member(v_source.organization_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of source organization';
  END IF;

  -- SECURITY: caller must be member of TARGET organization
  IF NOT is_organization_member(p_target_org_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of target organization';
  END IF;

  -- Prevent copying to the same organization
  IF v_source.organization_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organization are the same';
  END IF;

  -- Validate that target workspace belongs to target org
  SELECT organization_id INTO v_workspace_org_id
  FROM workspaces
  WHERE id = p_target_workspace_id;

  IF v_workspace_org_id IS NULL THEN
    RAISE EXCEPTION 'Target workspace not found: %', p_target_workspace_id;
  END IF;

  IF v_workspace_org_id <> p_target_org_id THEN
    RAISE EXCEPTION 'Target workspace does not belong to target organization';
  END IF;

  -- SECURITY: caller must be member of target workspace
  IF NOT is_workspace_member(p_target_workspace_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of target workspace';
  END IF;

  -- Create recording copy in target org
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

  -- Copy transcript_chunks WITHOUT embedding column.
  -- Embeddings are large vectors (up to 1536 floats each); copying them
  -- in bulk was the original cause of the statement timeout.
  -- They can be re-generated async if semantic search is needed.
  -- fts is GENERATED ALWAYS AS -- Postgres recomputes it automatically.
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

  -- Create workspace_entry in the specified target workspace
  INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
  VALUES (p_target_workspace_id, v_new_recording_id, NOW())
  ON CONFLICT (workspace_id, recording_id) DO NOTHING;

  -- Optionally delete the original recording
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
  'Copies transcript chunks WITHOUT embeddings (avoids timeout on large recordings). '
  'Function-level statement_timeout = 60s overrides Supabase default. '
  'Caller must be a member of both source and target orgs, and of the target workspace. '
  'When p_delete_original=true the source recording is deleted (caller must own it). '
  'Returns the new recording UUID.';

-- ============================================================================
-- 2. FIX copy_recording_to_organization (2-param — used by routing rules)
-- ============================================================================
-- Changes vs 20260309210000:
--   - Added function-level SET statement_timeout = '60s'
--   - Skip embedding column (was copying 1536-float vectors per chunk)
--   - Skip fts column (GENERATED ALWAYS AS -- cannot be inserted anyway)

CREATE OR REPLACE FUNCTION public.copy_recording_to_organization(
  p_recording_id UUID,
  p_target_org_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  v_caller_id UUID;
  v_source RECORD;
  v_new_recording_id UUID;
  v_target_home_workspace_id UUID;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_source
  FROM recordings
  WHERE id = p_recording_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Recording not found: %', p_recording_id;
  END IF;

  IF NOT is_organization_member(v_source.organization_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of source organization';
  END IF;

  IF NOT is_organization_member(p_target_org_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of target organization';
  END IF;

  IF v_source.organization_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organization are the same';
  END IF;

  SELECT id INTO v_target_home_workspace_id
  FROM workspaces
  WHERE organization_id = p_target_org_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_target_home_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Target organization has no HOME workspace';
  END IF;

  INSERT INTO recordings (
    organization_id, owner_user_id, title, audio_url, video_url,
    full_transcript, summary, global_tags, source_app, source_metadata,
    duration, recording_start_time, recording_end_time,
    source_call_id, created_at, synced_at
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
      'copied_from_org_id', v_source.organization_id,
      'copied_at', NOW()::TEXT,
      'copied_by', v_caller_id
    ),
    v_source.duration,
    v_source.recording_start_time,
    v_source.recording_end_time,
    NULL,
    NOW(),
    v_source.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- Copy transcript_chunks WITHOUT embedding (skip 1536-float vectors).
  -- fts is GENERATED ALWAYS AS -- Postgres recomputes it automatically.
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

  INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
  VALUES (v_target_home_workspace_id, v_new_recording_id, NOW())
  ON CONFLICT DO NOTHING;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.copy_recording_to_organization(UUID, UUID) IS
  'Copies a recording (and transcript_chunks) to a target organization. '
  'Caller must be a member of BOTH source and target orgs. '
  'Skips embedding vectors; function-level statement_timeout = 60s. '
  'New recording is placed in the target org HOME workspace.';

-- ============================================================================
-- 3. FIX route_recording_cross_org (5-param — called by edge functions)
-- ============================================================================
-- Changes vs 20260309210000:
--   - Added function-level SET statement_timeout = '60s'
--   - Skip embedding column (was copying 1536-float vectors per chunk)
--   - Skip fts column (GENERATED ALWAYS AS -- cannot be inserted)

CREATE OR REPLACE FUNCTION public.route_recording_cross_org(
  p_recording_id        UUID,
  p_target_org_id       UUID,
  p_user_id             UUID,
  p_delete_source       BOOLEAN DEFAULT false,
  p_target_workspace_id UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  v_source             RECORD;
  v_new_recording_id   UUID;
  v_home_workspace_id  UUID;
BEGIN
  -- Fetch source recording (bypasses RLS via SECURITY DEFINER)
  SELECT * INTO v_source FROM recordings WHERE id = p_recording_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Recording not found: %', p_recording_id;
  END IF;

  -- Guard: user must be member of the SOURCE org
  IF NOT is_organization_member(v_source.organization_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied: user % is not a member of source organization %', p_user_id, v_source.organization_id;
  END IF;

  -- Guard: user must be member of the TARGET org
  IF NOT is_organization_member(p_target_org_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied: user % is not a member of target organization %', p_user_id, p_target_org_id;
  END IF;

  -- Guard: cross-org only
  IF v_source.organization_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organization are the same (use same-org routing instead)';
  END IF;

  -- Create recording copy in target org
  INSERT INTO recordings (
    organization_id, owner_user_id, title, audio_url, video_url,
    full_transcript, summary, global_tags, source_app, source_metadata,
    duration, recording_start_time, recording_end_time,
    source_call_id, created_at, synced_at
  )
  VALUES (
    p_target_org_id,
    p_user_id,
    v_source.title,
    v_source.audio_url,
    v_source.video_url,
    v_source.full_transcript,
    v_source.summary,
    v_source.global_tags,
    v_source.source_app,
    COALESCE(v_source.source_metadata, '{}'::jsonb) || jsonb_build_object(
      'cross_org_routed_from_id',  p_recording_id,
      'cross_org_routed_from_org', v_source.organization_id,
      'cross_org_routed_at',       NOW()::TEXT,
      'cross_org_routed_by',       p_user_id
    ),
    v_source.duration,
    v_source.recording_start_time,
    v_source.recording_end_time,
    NULL,
    NOW(),
    v_source.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- Copy transcript_chunks WITHOUT embedding (skip 1536-float vectors).
  -- fts is GENERATED ALWAYS AS -- Postgres recomputes it automatically.
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
    created_at
  )
  SELECT
    v_new_recording_id,
    p_user_id,
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

  -- Relocate to target workspace if specified and different from HOME
  IF p_target_workspace_id IS NOT NULL THEN
    SELECT id INTO v_home_workspace_id
    FROM workspaces
    WHERE organization_id = p_target_org_id
      AND is_home = TRUE
    LIMIT 1;

    IF v_home_workspace_id IS NULL OR v_home_workspace_id != p_target_workspace_id THEN
      INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
      VALUES (p_target_workspace_id, v_new_recording_id, NOW())
      ON CONFLICT DO NOTHING;

      IF v_home_workspace_id IS NOT NULL THEN
        DELETE FROM workspace_entries
        WHERE recording_id = v_new_recording_id
          AND workspace_id = v_home_workspace_id;
      END IF;
    END IF;
  END IF;

  -- Delete source recording if requested (move semantics)
  IF p_delete_source THEN
    DELETE FROM transcript_chunks WHERE canonical_recording_id = p_recording_id;
    DELETE FROM workspace_entries WHERE recording_id = p_recording_id;
    DELETE FROM recordings WHERE id = p_recording_id;
  END IF;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) IS
  'Cross-org routing: copies a recording to a target organization and optionally deletes the source. '
  'Called by edge functions using service role -- takes p_user_id explicitly instead of auth.uid(). '
  'Skips embedding vectors; function-level statement_timeout = 60s. '
  'p_target_workspace_id: if set, moves the copy to that workspace instead of HOME.';

REVOKE EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
