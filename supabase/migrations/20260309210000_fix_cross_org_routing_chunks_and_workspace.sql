-- Migration: Fix cross-org routing — chunk unique constraint + target workspace placement
-- Purpose:
--   1. Relax transcript_chunks schema so cross-org copies can insert chunks without
--      hitting the UNIQUE(recording_id, chunk_index) constraint on the legacy BIGINT column.
--      Copied recordings do not have a fathom_calls entry in the target org, so recording_id
--      must be nullable for copies. Replace the constraint with UNIQUE(canonical_recording_id,
--      chunk_index) which correctly reflects the current data model.
--   2. Update route_recording_cross_org to accept an optional target_workspace_id so that
--      cross-org rules that specify a workspace (other than HOME) are respected.
--   3. Update copy_recording_to_organization (same chunk fix) and route copied chunks with
--      recording_id = NULL for copies.
-- Author: Claude (issue #99)
-- Date: 2026-03-09

-- ============================================================================
-- 1. RELAX transcript_chunks SCHEMA FOR CROSS-ORG COPIES
-- ============================================================================

-- Make recording_id nullable — cross-org copies have no fathom_calls entry in
-- the target org. NULL satisfies the FK (FK constraints ignore NULLs in SQL).
ALTER TABLE transcript_chunks
  ALTER COLUMN recording_id DROP NOT NULL;

-- Drop the legacy UNIQUE(recording_id, chunk_index) constraint.
-- The legacy BIGINT is not unique across organizations — copying chunks from org A
-- to org B would reuse the same recording_id BIGINT, violating the constraint.
-- The canonical primary key for uniqueness is now canonical_recording_id (UUID).
ALTER TABLE transcript_chunks
  DROP CONSTRAINT IF EXISTS transcript_chunks_recording_id_chunk_index_key;

-- Add the correct uniqueness constraint: one chunk per index per canonical recording.
-- WHERE clause excludes rows without a canonical recording (legacy chunks without backfill).
CREATE UNIQUE INDEX IF NOT EXISTS uq_transcript_chunks_canonical_chunk
  ON transcript_chunks (canonical_recording_id, chunk_index)
  WHERE canonical_recording_id IS NOT NULL;

-- ============================================================================
-- 2. UPDATE route_recording_cross_org — target workspace + chunk fix
-- ============================================================================
-- Changes vs previous version:
--   a) Added p_target_workspace_id parameter (optional; NULL = HOME workspace).
--   b) Chunk copy now sets recording_id = NULL (avoids BIGINT uniqueness conflict).
--   c) After trigger places copy in HOME, relocates to target workspace if specified.

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

  -- Guard (a): user must be member of the SOURCE org.
  IF NOT is_organization_member(v_source.organization_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied: user % is not a member of source organization %', p_user_id, v_source.organization_id;
  END IF;

  -- Guard (b): user must also be member of the TARGET org.
  IF NOT is_organization_member(p_target_org_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied: user % is not a member of target organization %', p_user_id, p_target_org_id;
  END IF;

  -- Guard: cross-org only — same-org routing uses the normal workspace entry path.
  IF v_source.organization_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organization are the same (use same-org routing instead)';
  END IF;

  -- Create recording copy in target org.
  -- source_call_id set to NULL to avoid unique-dedup constraint collision.
  -- The auto_create_default_workspace_entry trigger places the copy in the
  -- target org HOME workspace automatically after INSERT.
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
    NULL,   -- avoid dedup collision
    NOW(),
    v_source.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- Copy transcript_chunks linked to the source recording.
  -- recording_id is set to NULL: cross-org copies have no fathom_calls entry in
  -- the target org. canonical_recording_id is the authoritative FK for the copy.
  INSERT INTO transcript_chunks (
    canonical_recording_id, recording_id, user_id, chunk_text, chunk_index,
    speaker_name, speaker_email, call_date, call_title, call_category, topics,
    sentiment, intent_signals, user_tags, entities, source_platform, embedding, fts, created_at
  )
  SELECT
    v_new_recording_id,
    NULL,   -- recording_id: NULL for cross-org copies (no fathom_calls entry in target org)
    p_user_id,
    tc.chunk_text, tc.chunk_index, tc.speaker_name, tc.speaker_email,
    tc.call_date, tc.call_title, tc.call_category, tc.topics,
    tc.sentiment, tc.intent_signals, tc.user_tags, tc.entities,
    tc.source_platform, tc.embedding, tc.fts, NOW()
  FROM transcript_chunks tc
  WHERE tc.canonical_recording_id = p_recording_id;

  -- ---------------------------------------------------------------
  -- Relocate to target workspace if specified and different from HOME.
  -- The auto_create_default_workspace_entry trigger already placed the
  -- recording in HOME workspace. If the rule specifies a different workspace,
  -- we move it: insert the target entry, then remove the HOME entry.
  -- ---------------------------------------------------------------
  IF p_target_workspace_id IS NOT NULL THEN
    SELECT id INTO v_home_workspace_id
    FROM workspaces
    WHERE organization_id = p_target_org_id
      AND is_home = TRUE
    LIMIT 1;

    IF v_home_workspace_id IS NULL OR v_home_workspace_id != p_target_workspace_id THEN
      -- Insert target workspace entry (trigger already inserted HOME; upsert is safe)
      INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
      VALUES (p_target_workspace_id, v_new_recording_id, NOW())
      ON CONFLICT DO NOTHING;

      -- Remove HOME workspace entry (recording should land in target workspace only)
      IF v_home_workspace_id IS NOT NULL THEN
        DELETE FROM workspace_entries
        WHERE recording_id = v_new_recording_id
          AND workspace_id = v_home_workspace_id;
      END IF;
    END IF;
  END IF;

  -- Delete source recording if requested (move semantics).
  -- workspace_entries references recordings via FK — entries must be removed first.
  IF p_delete_source THEN
    DELETE FROM workspace_entries WHERE recording_id = p_recording_id;
    DELETE FROM recordings WHERE id = p_recording_id;
  END IF;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) IS
  'Cross-org routing: copies a recording to a target organization and optionally deletes the source. '
  'Called by edge functions using service role — takes p_user_id explicitly instead of auth.uid(). '
  'Verifies user membership in BOTH source and target orgs. '
  'p_target_workspace_id: if set, moves the copy to that workspace instead of HOME. '
  'Copied recording chunks set recording_id = NULL (no fathom_calls entry in target org).';

REVOKE EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) TO service_role;

-- ============================================================================
-- 3. UPDATE copy_recording_to_organization — same chunk fix
-- ============================================================================
-- The same UNIQUE(recording_id, chunk_index) violation affects this RPC.
-- Set recording_id = NULL for copied chunks (consistent with route_recording_cross_org).

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

  -- Copy transcript_chunks.
  -- recording_id = NULL: cross-org copies have no fathom_calls entry in the target org.
  INSERT INTO transcript_chunks (
    canonical_recording_id, recording_id, user_id, chunk_text, chunk_index,
    speaker_name, speaker_email, call_date, call_title, call_category, topics,
    sentiment, intent_signals, user_tags, entities, source_platform, embedding, fts, created_at
  )
  SELECT
    v_new_recording_id,
    NULL,   -- recording_id: NULL for cross-org copies (no fathom_calls entry in target org)
    v_caller_id,
    tc.chunk_text, tc.chunk_index, tc.speaker_name, tc.speaker_email,
    tc.call_date, tc.call_title, tc.call_category, tc.topics,
    tc.sentiment, tc.intent_signals, tc.user_tags, tc.entities,
    tc.source_platform, tc.embedding, tc.fts, NOW()
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
  'New recording is placed in the target org HOME workspace. '
  'Copied chunks set recording_id = NULL (no fathom_calls entry in target org).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
