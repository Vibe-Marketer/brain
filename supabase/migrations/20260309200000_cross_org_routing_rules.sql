-- Migration: Cross-org routing rules
-- Purpose: Extend import_routing_rules with target_organization_id (nullable) to support routing
--          calls to a different org by copying the recording. Adds delete_after_copy for
--          per-rule copy/move preference. Updates INSERT/UPDATE RLS to require target org
--          membership. Adds route_recording_cross_org RPC callable by service-role edge functions.
-- Author: Claude (issue #99)
-- Date: 2026-03-09

-- ============================================================================
-- 1. ADD COLUMNS TO import_routing_rules
-- ============================================================================

-- target_organization_id: NULL = same-org rule (existing behavior, no change).
--   Non-null = route matching calls to this org by copying the recording there.
--   User must be a member of the target org to create or update this rule (enforced by RLS).
ALTER TABLE import_routing_rules
  ADD COLUMN target_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;

-- delete_after_copy: per-rule override for copy preference.
--   false (default) = keep source-org recording after cross-org copy ("keep" semantics).
--   true  = delete source-org recording after copying ("move" semantics).
--   Only meaningful when target_organization_id IS NOT NULL.
ALTER TABLE import_routing_rules
  ADD COLUMN delete_after_copy BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. UPDATE RLS POLICIES
-- ============================================================================
-- The old INSERT/UPDATE policies use the pre-rename policy name "Bank members …".
-- Drop and replace with org-aware policies that also require target org membership
-- for cross-org rules.

-- INSERT: require membership in both source and target orgs
DROP POLICY IF EXISTS "Bank members can insert routing rules" ON import_routing_rules;

CREATE POLICY "Org members can insert routing rules"
  ON import_routing_rules FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND is_organization_member(import_routing_rules.organization_id, auth.uid())
    AND (
      import_routing_rules.target_organization_id IS NULL
      OR is_organization_member(import_routing_rules.target_organization_id, auth.uid())
    )
  );

-- UPDATE: same dual-membership requirement
DROP POLICY IF EXISTS "Bank members can update routing rules" ON import_routing_rules;

CREATE POLICY "Org members can update routing rules"
  ON import_routing_rules FOR UPDATE
  USING (
    is_organization_member(import_routing_rules.organization_id, auth.uid())
  )
  WITH CHECK (
    is_organization_member(import_routing_rules.organization_id, auth.uid())
    AND (
      import_routing_rules.target_organization_id IS NULL
      OR is_organization_member(import_routing_rules.target_organization_id, auth.uid())
    )
  );

-- ============================================================================
-- 3. CROSS-ORG ROUTING COPY RPC
-- ============================================================================
-- Called by edge functions running as service role, so we cannot rely on
-- auth.uid(). Instead, the caller passes p_user_id explicitly.
-- Security (defense-in-depth):
--   a) REVOKE EXECUTE FROM PUBLIC + GRANT only to service_role so direct
--      PostgREST callers cannot invoke it.
--   b) Source org membership verified explicitly inside the function body so
--      that even a misconfigured grant cannot leak recordings across orgs.
-- After insert the auto_create_default_workspace_entry trigger places the copy
-- in the target org's HOME workspace automatically.

CREATE OR REPLACE FUNCTION public.route_recording_cross_org(
  p_recording_id   UUID,
  p_target_org_id  UUID,
  p_user_id        UUID,
  p_delete_source  BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source           RECORD;
  v_new_recording_id UUID;
BEGIN
  -- Fetch source recording (bypasses RLS via SECURITY DEFINER)
  SELECT * INTO v_source FROM recordings WHERE id = p_recording_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Recording not found: %', p_recording_id;
  END IF;

  -- Guard (a): user must be member of the SOURCE org.
  -- This prevents cross-org exfiltration even if execute grants are misconfigured.
  IF NOT is_organization_member(v_source.organization_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied: user % is not a member of source organization %', p_user_id, v_source.organization_id;
  END IF;

  -- Guard (b): user must also be member of the TARGET org.
  IF NOT is_organization_member(p_target_org_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied: user % is not a member of target organization %', p_user_id, p_target_org_id;
  END IF;

  -- Guard: cross-org only — same-org routing uses the normal workspace entry path
  IF v_source.organization_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organization are the same (use same-org routing instead)';
  END IF;

  -- Create recording copy in target org.
  -- source_call_id set to NULL to avoid unique-dedup constraint collision.
  -- The auto_create_default_workspace_entry trigger will place the copy in the
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

  -- Copy transcript_chunks linked to the source recording
  INSERT INTO transcript_chunks (
    canonical_recording_id, recording_id, user_id, chunk_text, chunk_index,
    speaker_name, speaker_email, call_date, call_title, call_category, topics,
    sentiment, intent_signals, user_tags, entities, source_platform, embedding, fts, created_at
  )
  SELECT
    v_new_recording_id,
    tc.recording_id,
    p_user_id,
    tc.chunk_text, tc.chunk_index, tc.speaker_name, tc.speaker_email,
    tc.call_date, tc.call_title, tc.call_category, tc.topics,
    tc.sentiment, tc.intent_signals, tc.user_tags, tc.entities,
    tc.source_platform, tc.embedding, tc.fts, NOW()
  FROM transcript_chunks tc
  WHERE tc.canonical_recording_id = p_recording_id;

  -- Delete source recording if requested (move semantics)
  IF p_delete_source THEN
    DELETE FROM recordings WHERE id = p_recording_id;
  END IF;

  RETURN v_new_recording_id;
END;
$$;

COMMENT ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN) IS
  'Cross-org routing: copies a recording to a target organization and optionally deletes the source. '
  'Called by edge functions using service role — takes p_user_id explicitly instead of auth.uid(). '
  'Verifies user membership in BOTH source and target orgs. Copied recording lands in target HOME workspace via trigger.';

-- Restrict direct invocation: only service_role (used by edge functions) may call this.
-- Public users cannot call it via PostgREST even if they know a recording UUID.
REVOKE EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN) TO service_role;

-- ============================================================================
-- COLUMN COMMENTS
-- ============================================================================

COMMENT ON COLUMN import_routing_rules.target_organization_id IS
  'When set, matching calls are copied to this organization (cross-org routing). '
  'NULL = same-org routing (original behavior). '
  'Creating or updating a rule with this set requires the user to be a member of the target org (enforced by RLS).';

COMMENT ON COLUMN import_routing_rules.delete_after_copy IS
  'Per-rule copy preference for cross-org rules. '
  'false = keep source-org recording after copying (default). '
  'true = delete source-org recording after copying (move semantics). '
  'Ignored for same-org rules (target_organization_id IS NULL).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
