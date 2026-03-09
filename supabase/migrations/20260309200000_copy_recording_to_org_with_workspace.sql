-- Migration: Cross-org copy RPC with target workspace + delete_original support
-- Purpose: Extends cross-org copy to allow specifying a target workspace and
--          optionally deleting the original after copy. Closes #98.
-- Author: Claude (issue #98)
-- Date: 2026-03-09

-- ============================================================================
-- 0. SCHEMA FIX: transcript_chunks.recording_id
-- ============================================================================
-- The legacy BIGINT recording_id column has UNIQUE(recording_id, chunk_index).
-- Cross-org copies must produce new chunk rows with the same chunk_index values
-- but no valid Fathom recording_id — setting the same BIGINT would violate the
-- unique constraint.
--
-- Fix: make recording_id nullable and convert the full-table UNIQUE into a
-- partial UNIQUE (WHERE recording_id IS NOT NULL) so existing Fathom-sourced
-- rows retain their uniqueness guarantee but copy rows can use NULL.
--
-- Also drop the old FK constraint name alias if it survived from before
-- 20251201000001 (DROP IF EXISTS is safe if already gone).

-- Step 1: Make the column nullable (was NOT NULL from original schema)
ALTER TABLE public.transcript_chunks
  ALTER COLUMN recording_id DROP NOT NULL;

-- Step 2: Drop the full-table unique constraint
ALTER TABLE public.transcript_chunks
  DROP CONSTRAINT IF EXISTS transcript_chunks_recording_id_chunk_index_key;

-- Step 3: Re-add as a partial unique constraint (only enforced when recording_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_transcript_chunks_recording_chunk
  ON public.transcript_chunks (recording_id, chunk_index)
  WHERE recording_id IS NOT NULL;

COMMENT ON COLUMN public.transcript_chunks.recording_id IS
  'Legacy Fathom BIGINT recording ID. NULL for cross-org copies and non-Fathom recordings. '
  'Unique per chunk_index only when non-NULL (partial unique index). '
  'Modern recordings use canonical_recording_id (UUID) instead.';

-- ============================================================================
-- 1. ENHANCED COPY RPC: copy_recording_to_org
-- ============================================================================
-- Copies a recording to a target org + specific workspace, with optional
-- original deletion (copy+keep vs copy+delete preference).
--
-- SECURITY:
--   - Caller must be member of BOTH source and target organizations.
--   - p_target_workspace_id must belong to p_target_org_id.
--   - Delete original: caller must own the recording.
--
-- Returns the new recording UUID.

CREATE OR REPLACE FUNCTION public.copy_recording_to_org(
  p_recording_id    UUID,
  p_target_org_id   UUID,
  p_target_workspace_id UUID,
  p_delete_original BOOLEAN DEFAULT FALSE
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

  -- Use IF NOT FOUND (PL/pgSQL special variable), not IS NULL.
  -- SELECT INTO a RECORD leaves all fields NULL when no row matches,
  -- so IS NULL would pass even when the recording doesn't exist.
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
  -- Copy transcript_chunks (only modern UUID-linked chunks).
  -- recording_id (BIGINT) is intentionally omitted (defaults to NULL).
  -- We cannot reuse tc.recording_id because UNIQUE(recording_id, chunk_index)
  -- would collide with the source rows. After the schema fix in section 0,
  -- recording_id is nullable, so NULL is valid and means "copy — no Fathom ID".
  -- ---------------------------------------------------------------
  -- fts is GENERATED ALWAYS AS — omit from INSERT; Postgres recomputes it automatically.
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
    embedding,
    created_at
  )
  SELECT
    v_new_recording_id,
    v_caller_id,  -- caller becomes owner of the copied chunks
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
    NOW()
  FROM transcript_chunks tc
  WHERE tc.canonical_recording_id = p_recording_id;

  -- ---------------------------------------------------------------
  -- Create workspace_entry in the specified target workspace.
  -- The auto-entry trigger also fires (HOME workspace), but we
  -- honour the caller's explicit workspace choice here.
  -- Explicit conflict target: handles the case where HOME = target
  -- workspace without silently swallowing unrelated violations.
  -- ---------------------------------------------------------------
  INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
  VALUES (p_target_workspace_id, v_new_recording_id, NOW())
  ON CONFLICT (workspace_id, recording_id) DO NOTHING;

  -- ---------------------------------------------------------------
  -- Optionally delete the original recording.
  -- Caller must be the recording owner (pre-checked above; delete_recording
  -- also re-checks internally — redundant but harmless).
  -- delete_recording() returns JSONB: success object or {error: ...}.
  -- Capture and raise on error so the failure propagates and rolls back.
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
  'Caller must be a member of both source and target orgs, and of the target workspace. '
  'When p_delete_original=true the source recording is deleted (caller must own it). '
  'Returns the new recording UUID. Closes #98.';


-- ============================================================================
-- 2. BACKFILL user_profiles.auto_processing_preferences DEFAULT
-- ============================================================================
-- Add crossOrgCopyBehavior key to the default JSONB on existing rows that
-- don't yet have it. New rows get it from the column default below.

UPDATE public.user_profiles
SET auto_processing_preferences =
  COALESCE(auto_processing_preferences, '{}'::jsonb)
  || '{"crossOrgCopyBehavior": "copy_keep"}'::jsonb
WHERE auto_processing_preferences IS NULL
   OR NOT (auto_processing_preferences ? 'crossOrgCopyBehavior');

-- Update column default so new rows include the key from the start
ALTER TABLE public.user_profiles
  ALTER COLUMN auto_processing_preferences
  SET DEFAULT '{
    "autoProcessingTitleGeneration": false,
    "autoProcessingTagging": false,
    "crossOrgCopyBehavior": "copy_keep"
  }'::jsonb;

COMMENT ON COLUMN public.user_profiles.auto_processing_preferences IS
  'User preferences for auto-processing features: '
  'autoProcessingTitleGeneration (AI-generated call titles), '
  'autoProcessingTagging (automatic call tagging), '
  'crossOrgCopyBehavior ("copy_keep" or "copy_delete").';

-- ============================================================================
-- 3. DROP SUPERSEDED COPY FUNCTION
-- ============================================================================
-- copy_recording_to_organization(UUID, UUID) was introduced in migration
-- 20260308100000 and always copied to the HOME workspace only. It is now a
-- strict subset of copy_recording_to_org(UUID, UUID, UUID, BOOLEAN), which
-- supports any target workspace and optional delete. Drop the old function to
-- avoid two diverging code paths for the same operation.

DROP FUNCTION IF EXISTS public.copy_recording_to_organization(UUID, UUID);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
