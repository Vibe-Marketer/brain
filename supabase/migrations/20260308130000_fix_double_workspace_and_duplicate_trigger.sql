-- Migration: Fix double workspace on signup + drop duplicate recording trigger
-- Purpose: (1) handle_new_user() now sets is_home=TRUE on the 'My Calls' workspace,
--          so personal orgs have a single combined default+home workspace.
--          (2) ensure_home_workspace() skips personal orgs (handled by handle_new_user).
--          (3) Drop duplicate auto_create_default_workspace_entry trigger — the
--          auto_home_workspace_entry trigger (from lifecycle_rules) already does this.
-- Closes: #80
-- Date: 2026-03-08

-- ============================================================================
-- 1. FIX handle_new_user() — set is_home=TRUE on personal workspace
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

  -- Create default personal workspace with is_default AND is_home
  INSERT INTO workspaces (organization_id, name, workspace_type, is_default, is_home)
  VALUES (v_organization_id, 'My Calls', 'personal', TRUE, TRUE)
  RETURNING id INTO v_workspace_id;

  -- Create workspace membership as owner
  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'workspace_owner');

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. FIX ensure_home_workspace() — skip personal orgs
-- ============================================================================
-- Personal orgs already get their home workspace from handle_new_user().
-- Only business orgs need the trigger to auto-create a home workspace.
CREATE OR REPLACE FUNCTION ensure_home_workspace()
RETURNS TRIGGER AS $$
BEGIN
  -- Personal orgs get their home workspace from handle_new_user()
  IF NEW.type = 'personal' THEN
    RETURN NEW;
  END IF;

  INSERT INTO workspaces (organization_id, name, workspace_type, is_home)
  VALUES (NEW.id, 'Home Workspace', 'team', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. FIX ensure_personal_organization() — set is_home=TRUE on workspace
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
    -- Create personal workspace with is_home=TRUE
    INSERT INTO workspaces (organization_id, name, workspace_type, is_default, is_home)
    VALUES (v_organization_id, 'My Calls', 'personal', TRUE, TRUE)
    RETURNING id INTO v_workspace_id;

    -- Create workspace membership as owner
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'workspace_owner');
  END IF;

  RETURN v_organization_id;
END;
$function$;

-- ============================================================================
-- 4. DROP duplicate recording INSERT trigger
-- ============================================================================
-- auto_home_workspace_entry (from lifecycle_rules) and
-- tr_auto_create_default_workspace_entry (from cross_org_copy_and_auto_entry)
-- both fire on recording INSERT doing the same thing. Keep auto_home_workspace_entry.
DROP TRIGGER IF EXISTS tr_auto_create_default_workspace_entry ON recordings;
DROP FUNCTION IF EXISTS public.auto_create_default_workspace_entry();

-- ============================================================================
-- 5. BACKFILL: Fix existing personal orgs that have duplicate workspaces
-- ============================================================================
-- For personal orgs where handle_new_user created 'My Calls' (is_default=true)
-- AND ensure_home_workspace created 'Home Workspace' (is_home=true):
-- Set is_home=TRUE on 'My Calls' and remove the extra 'Home Workspace'.
DO $$
DECLARE
  org RECORD;
  my_calls_id UUID;
  home_ws_id UUID;
BEGIN
  FOR org IN
    SELECT o.id AS org_id
    FROM organizations o
    WHERE o.type = 'personal'
  LOOP
    -- Find 'My Calls' workspace (is_default=true, is_home=false)
    SELECT id INTO my_calls_id
    FROM workspaces
    WHERE organization_id = org.org_id
      AND is_default = TRUE
      AND is_home = FALSE
    LIMIT 1;

    -- Find orphaned 'Home Workspace' (is_home=true, different from My Calls)
    SELECT id INTO home_ws_id
    FROM workspaces
    WHERE organization_id = org.org_id
      AND is_home = TRUE
      AND id IS DISTINCT FROM my_calls_id
    LIMIT 1;

    -- Only fix if both exist (the double-workspace scenario)
    IF my_calls_id IS NOT NULL AND home_ws_id IS NOT NULL THEN
      -- Move any workspace_entries from 'Home Workspace' to 'My Calls'
      UPDATE workspace_entries
      SET workspace_id = my_calls_id
      WHERE workspace_id = home_ws_id
        AND NOT EXISTS (
          SELECT 1 FROM workspace_entries e2
          WHERE e2.workspace_id = my_calls_id
            AND e2.recording_id = workspace_entries.recording_id
        );

      -- Delete remaining duplicate entries (already exist in My Calls)
      DELETE FROM workspace_entries WHERE workspace_id = home_ws_id;

      -- Move any workspace_memberships from 'Home Workspace' to 'My Calls'
      UPDATE workspace_memberships
      SET workspace_id = my_calls_id
      WHERE workspace_id = home_ws_id
        AND NOT EXISTS (
          SELECT 1 FROM workspace_memberships m2
          WHERE m2.workspace_id = my_calls_id
            AND m2.user_id = workspace_memberships.user_id
        );

      -- Delete remaining duplicate memberships
      DELETE FROM workspace_memberships WHERE workspace_id = home_ws_id;

      -- Set is_home on My Calls
      UPDATE workspaces SET is_home = TRUE WHERE id = my_calls_id;

      -- Delete the orphaned Home Workspace
      DELETE FROM workspaces WHERE id = home_ws_id;
    END IF;

    -- Handle case where only My Calls exists but isn't marked as home
    IF my_calls_id IS NOT NULL AND home_ws_id IS NULL THEN
      UPDATE workspaces SET is_home = TRUE
      WHERE id = my_calls_id AND is_home = FALSE;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
