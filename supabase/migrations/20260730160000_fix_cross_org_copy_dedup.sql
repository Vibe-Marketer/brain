-- Migration: Fix cross-org copy/move deduplication (ticket 8c1761e6)
-- Problem: copy_recording_to_org, copy_recording_to_organization, and
--          route_recording_cross_org all explicitly NULL out source_call_id
--          on the copy ("source_call_id NULL to avoid dedup constraint
--          collision" -- see 20260331050000). That comment described the
--          symptom, not a fix: nulling the column doesn't dedupe, it
--          DISABLES the existing recordings_source_dedup unique constraint
--          for every cross-org copy, because Postgres never considers two
--          NULLs equal in a UNIQUE constraint. Every repeated Move/Copy of
--          the same call into the same target org (double-click, re-running
--          the same copy, a routing rule firing twice) created a brand new
--          `recordings` row with a brand new UUID -- an exact duplicate.
--          Confirmed in prod: ~20 duplicate recordings created when a user
--          copied the same batch of Fathom sales calls into another
--          workspace/org twice.
-- Fix:
--   1. Preserve v_source.source_call_id (and source_app) on the copy instead
--      of nulling it, so the existing org-scoped unique constraint
--      recordings_source_dedup (organization_id, source_app, source_call_id)
--      applies to cross-org copies exactly as it already does to connector
--      imports (see 20260303000004 / connector-sync-all/index.ts).
--   2. Proactively look up an existing match before inserting (fast path,
--      matches the connector-sync-all idempotency pattern), AND wrap the
--      INSERT in an EXCEPTION WHEN unique_violation handler (race-safety
--      net for concurrent/double-click submits) that falls back to the
--      existing row instead of raising.
--   3. Either way, ensure the recording is linked into the requested target
--      workspace (idempotent ON CONFLICT DO NOTHING) and return its id.
--      The client never sees an error and never gets a duplicate -- exactly
--      the ticket's ask. p_delete_original / p_delete_source still runs so
--      "Move" completes even when the destination already has the call.
--   4. transcript_chunks are only (re-)copied when a NEW recording row was
--      actually inserted -- the dedup/race-fallback paths reuse the
--      existing row's chunks untouched.
-- Author: Claude (ticket 8c1761e6-5b74-4382-80f1-3fb0c9b694c1)
-- Date: 2026-07-30

-- ============================================================================
-- 1. FIX copy_recording_to_org (4-param -- called by frontend MoveOrCopyDialog)
-- ============================================================================

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
  v_source               RECORD;
  v_new_recording_id     UUID;
  v_existing_recording_id UUID;
  v_did_insert           BOOLEAN := FALSE;
  v_workspace_org_id     UUID;
  v_delete_result        JSONB;
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

  -- DEDUP fast path: this exact provider call may already have been copied
  -- into the target org by a prior Move/Copy action.
  IF v_source.source_call_id IS NOT NULL THEN
    SELECT id INTO v_existing_recording_id
    FROM recordings
    WHERE organization_id = p_target_org_id
      AND source_app = v_source.source_app
      AND source_call_id = v_source.source_call_id
    LIMIT 1;
  END IF;

  IF v_existing_recording_id IS NOT NULL THEN
    v_new_recording_id := v_existing_recording_id;
  ELSE
    BEGIN
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
        v_source.source_call_id,  -- preserved: lets recordings_source_dedup do its job
        NOW(),
        v_source.synced_at
      )
      RETURNING id INTO v_new_recording_id;

      v_did_insert := TRUE;
    EXCEPTION WHEN unique_violation THEN
      -- Race: a concurrent copy (double-click, duplicate submit) won first.
      -- Reuse the row it created instead of surfacing an error to the client.
      SELECT id INTO v_new_recording_id
      FROM recordings
      WHERE organization_id = p_target_org_id
        AND source_app = v_source.source_app
        AND source_call_id = v_source.source_call_id
      LIMIT 1;

      IF v_new_recording_id IS NULL THEN
        RAISE; -- not the dedup constraint after all; surface the real error
      END IF;
    END;
  END IF;

  -- Copy transcript_chunks WITHOUT embedding column -- only for a genuinely
  -- new recording row. A reused (deduped) row already has its chunks.
  IF v_did_insert THEN
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
  END IF;

  -- Ensure it's linked in the requested target workspace, whether it was
  -- just created or reused from a prior copy (idempotent).
  INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
  VALUES (p_target_workspace_id, v_new_recording_id, NOW())
  ON CONFLICT (workspace_id, recording_id) DO NOTHING;

  -- Optionally delete the original recording (still runs on the dedup path
  -- so a "Move" completes even when the destination already had the call)
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
  'Deduplicates on (organization_id, source_app, source_call_id) via '
  'recordings_source_dedup -- repeated copies of the same call reuse the '
  'existing row instead of creating duplicates, and never error to the client. '
  'Copies transcript chunks WITHOUT embeddings (avoids timeout on large recordings). '
  'Function-level statement_timeout = 60s overrides Supabase default. '
  'Caller must be a member of both source and target orgs, and of the target workspace. '
  'When p_delete_original=true the source recording is deleted (caller must own it). '
  'Returns the new (or existing, if deduped) recording UUID.';

-- ============================================================================
-- 2. FIX copy_recording_to_organization (2-param -- used by routing rules)
-- ============================================================================

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
  v_caller_id                UUID;
  v_source                   RECORD;
  v_new_recording_id         UUID;
  v_existing_recording_id    UUID;
  v_did_insert                BOOLEAN := FALSE;
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

  -- DEDUP fast path (see copy_recording_to_org above for full rationale)
  IF v_source.source_call_id IS NOT NULL THEN
    SELECT id INTO v_existing_recording_id
    FROM recordings
    WHERE organization_id = p_target_org_id
      AND source_app = v_source.source_app
      AND source_call_id = v_source.source_call_id
    LIMIT 1;
  END IF;

  IF v_existing_recording_id IS NOT NULL THEN
    v_new_recording_id := v_existing_recording_id;
  ELSE
    BEGIN
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
        v_source.source_call_id,
        NOW(),
        v_source.synced_at
      )
      RETURNING id INTO v_new_recording_id;

      v_did_insert := TRUE;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_new_recording_id
      FROM recordings
      WHERE organization_id = p_target_org_id
        AND source_app = v_source.source_app
        AND source_call_id = v_source.source_call_id
      LIMIT 1;

      IF v_new_recording_id IS NULL THEN
        RAISE;
      END IF;
    END;
  END IF;

  IF v_did_insert THEN
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
  END IF;

  INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
  VALUES (v_target_home_workspace_id, v_new_recording_id, NOW())
  ON CONFLICT DO NOTHING;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.copy_recording_to_organization(UUID, UUID) IS
  'Copies a recording (and transcript_chunks) to a target organization. '
  'Deduplicates on (organization_id, source_app, source_call_id) via '
  'recordings_source_dedup -- repeated routing/copy of the same call reuses '
  'the existing row instead of creating duplicates. '
  'Caller must be a member of BOTH source and target orgs. '
  'Skips embedding vectors; function-level statement_timeout = 60s. '
  'New (or existing, if deduped) recording is placed in the target org HOME workspace.';

-- ============================================================================
-- 3. FIX route_recording_cross_org (5-param -- called by edge functions)
-- ============================================================================

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
  v_source                RECORD;
  v_new_recording_id      UUID;
  v_existing_recording_id UUID;
  v_did_insert             BOOLEAN := FALSE;
  v_home_workspace_id     UUID;
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

  -- DEDUP fast path (see copy_recording_to_org above for full rationale)
  IF v_source.source_call_id IS NOT NULL THEN
    SELECT id INTO v_existing_recording_id
    FROM recordings
    WHERE organization_id = p_target_org_id
      AND source_app = v_source.source_app
      AND source_call_id = v_source.source_call_id
    LIMIT 1;
  END IF;

  IF v_existing_recording_id IS NOT NULL THEN
    v_new_recording_id := v_existing_recording_id;
  ELSE
    BEGIN
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
        v_source.source_call_id,
        NOW(),
        v_source.synced_at
      )
      RETURNING id INTO v_new_recording_id;

      v_did_insert := TRUE;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_new_recording_id
      FROM recordings
      WHERE organization_id = p_target_org_id
        AND source_app = v_source.source_app
        AND source_call_id = v_source.source_call_id
      LIMIT 1;

      IF v_new_recording_id IS NULL THEN
        RAISE;
      END IF;
    END;
  END IF;

  IF v_did_insert THEN
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
  END IF;

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

  -- Delete source recording if requested (move semantics) -- still runs on
  -- the dedup path so a "move" completes even when the destination already
  -- had the call.
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
  'Deduplicates on (organization_id, source_app, source_call_id) via '
  'recordings_source_dedup -- repeated routing of the same call reuses the '
  'existing row instead of creating duplicates. '
  'Called by edge functions using service role -- takes p_user_id explicitly instead of auth.uid(). '
  'Skips embedding vectors; function-level statement_timeout = 60s. '
  'p_target_workspace_id: if set, moves the copy to that workspace instead of HOME.';

REVOKE EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID) TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
