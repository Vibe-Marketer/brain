-- Migration: Naming cleanup — remove stale bank/vault references from SQL functions
-- Purpose: Rename cross_bank_default column, update default org name 'Personal' → 'Main',
--          fix default workspace name, clean up stale comments in all recreated functions
-- Date: 2026-03-03

BEGIN;

-- ============================================================================
-- 1. RENAME COLUMN: organizations.cross_bank_default → cross_org_default
-- ============================================================================
ALTER TABLE organizations RENAME COLUMN cross_bank_default TO cross_org_default;

-- ============================================================================
-- 2. RECREATE handle_new_user() — 'Personal' → 'Main', fix comments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
BEGIN
  -- Insert profile for new user
  INSERT INTO public.user_profiles (user_id, email, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false
  );

  -- Assign default FREE role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create personal organization for new user
  INSERT INTO organizations (name, type)
  VALUES ('Main', 'personal')
  RETURNING id INTO v_organization_id;

  -- Create organization membership as owner
  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, NEW.id, 'organization_owner');

  -- Create default personal workspace with is_default = TRUE
  INSERT INTO workspaces (organization_id, name, workspace_type, is_default)
  VALUES (v_organization_id, 'My Calls', 'personal', TRUE)
  RETURNING id INTO v_workspace_id;

  -- Create workspace membership as owner
  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'workspace_owner');

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3. RECREATE ensure_personal_organization() — 'Personal' → 'Main', fix comments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_personal_organization(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
BEGIN
  -- Check if user already has a personal organization
  SELECT b.id INTO v_organization_id
  FROM organizations b
  JOIN organization_memberships bm ON bm.organization_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  -- If personal organization exists, return it (idempotent)
  IF v_organization_id IS NOT NULL THEN
    RETURN v_organization_id;
  END IF;

  -- Create personal organization
  INSERT INTO organizations (name, type)
  VALUES ('Main', 'personal')
  RETURNING id INTO v_organization_id;

  -- Create organization membership as owner
  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, p_user_id, 'organization_owner');

  -- Check if user already has a personal workspace in this organization (defensive)
  SELECT v.id INTO v_workspace_id
  FROM workspaces v
  JOIN workspace_memberships vm ON vm.workspace_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.organization_id = v_organization_id
    AND v.workspace_type = 'personal'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    -- Create personal workspace
    INSERT INTO workspaces (organization_id, name, workspace_type)
    VALUES (v_organization_id, 'My Calls', 'personal')
    RETURNING id INTO v_workspace_id;

    -- Create workspace membership as owner
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'workspace_owner');
  END IF;

  RETURN v_organization_id;
END;
$function$;

-- ============================================================================
-- 4. RECREATE migrate_fathom_call_to_recording() — 'Personal' → 'Main', fix comments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.migrate_fathom_call_to_recording(p_recording_id bigint, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
  v_new_recording_id UUID;
  v_call RECORD;
BEGIN
  -- Get user's personal organization
  SELECT b.id INTO v_organization_id
  FROM organizations b
  JOIN organization_memberships bm ON bm.organization_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    -- User doesn't have a personal organization yet — create one
    -- This handles legacy users who signed up before the Organization/Workspace architecture
    INSERT INTO organizations (name, type)
    VALUES ('Main', 'personal')
    RETURNING id INTO v_organization_id;

    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (v_organization_id, p_user_id, 'organization_owner');
  END IF;

  -- Get user's personal workspace
  SELECT v.id INTO v_workspace_id
  FROM workspaces v
  JOIN workspace_memberships vm ON vm.workspace_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.organization_id = v_organization_id
    AND v.workspace_type = 'personal'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    -- User doesn't have a personal workspace yet — create one
    INSERT INTO workspaces (organization_id, name, workspace_type)
    VALUES (v_organization_id, 'My Calls', 'personal')
    RETURNING id INTO v_workspace_id;

    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'workspace_owner');
  END IF;

  -- Check if already migrated (idempotency)
  SELECT id INTO v_new_recording_id
  FROM recordings
  WHERE legacy_recording_id = p_recording_id AND organization_id = v_organization_id;

  IF v_new_recording_id IS NOT NULL THEN
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
  INSERT INTO recordings (
    legacy_recording_id,
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
    created_at,
    synced_at
  ) VALUES (
    v_call.recording_id,
    v_organization_id,
    p_user_id,
    COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call'),
    v_call.url,
    v_call.share_url,
    v_call.full_transcript,
    v_call.summary,
    COALESCE(v_call.auto_tags, '{}'),
    COALESCE(v_call.source_platform, 'fathom'),
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

  -- Create workspace entry in personal workspace
  INSERT INTO workspace_entries (
    workspace_id,
    recording_id,
    local_tags,
    created_at
  ) VALUES (
    v_workspace_id,
    v_new_recording_id,
    '{}',
    v_call.created_at
  );

  RETURN v_new_recording_id;
END;
$function$;

-- ============================================================================
-- 5. RECREATE create_business_organization() — fix param/var names, default workspace name
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_business_organization(text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_business_organization(
  p_name text,
  p_cross_org_default text DEFAULT 'copy_only'::text,
  p_logo_url text DEFAULT NULL::text,
  p_default_workspace_name text DEFAULT NULL::text
)
 RETURNS TABLE(organization_id uuid, workspace_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
  v_workspace_id UUID;
  v_name TEXT;
  v_cross_org_default TEXT;
  v_workspace_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := trim(p_name);
  IF v_name IS NULL OR length(v_name) < 3 OR length(v_name) > 50 THEN
    RAISE EXCEPTION 'Organization name must be between 3 and 50 characters';
  END IF;

  v_cross_org_default := COALESCE(p_cross_org_default, 'copy_only');
  IF v_cross_org_default NOT IN ('copy_only', 'copy_and_remove') THEN
    v_cross_org_default := 'copy_only';
  END IF;

  v_workspace_name := COALESCE(NULLIF(trim(p_default_workspace_name), ''), v_name || '''s Workspace');

  INSERT INTO organizations (name, type, cross_org_default, logo_url)
  VALUES (v_name, 'business', v_cross_org_default, p_logo_url)
  RETURNING id INTO v_organization_id;

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, v_user_id, 'organization_owner');

  INSERT INTO workspaces (organization_id, name, workspace_type)
  VALUES (v_organization_id, v_workspace_name, 'team')
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'workspace_owner');

  organization_id := v_organization_id;
  workspace_id := v_workspace_id;
  RETURN NEXT;
END;
$function$;

-- ============================================================================
-- 6. Fix stale comments in update_routing_rule_priorities()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_routing_rule_priorities(p_organization_id uuid, p_rule_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rule_id UUID;
  v_priority INTEGER := 1;
BEGIN
  -- Verify caller is a member of this organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not a member of organization %', p_organization_id;
  END IF;

  -- Update each rule's priority to its 1-based array position
  FOREACH v_rule_id IN ARRAY p_rule_ids LOOP
    UPDATE import_routing_rules
    SET priority = v_priority,
        updated_at = now()
    WHERE id = v_rule_id
      AND organization_id = p_organization_id;

    v_priority := v_priority + 1;
  END LOOP;
END;
$function$;

COMMIT;
