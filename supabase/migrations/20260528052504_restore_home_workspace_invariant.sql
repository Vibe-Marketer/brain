-- Migration: Restore the home-workspace invariant for business organizations
-- Purpose: Fix "TARGET ORGANIZATION HAS NO HOME WORKSPACE" error reported for
--          organizations created via `create_business_organization` RPC after the
--          `tr_ensure_home_workspace` trigger was dropped from production out-of-band.
--
-- Root cause (full forensics in .planning/debug/new-org-no-home-workspace.md):
--   1. `tr_ensure_home_workspace` was created in 20260306000000_personal_organization_and_home.sql
--      as AFTER INSERT ON organizations to auto-flag every new org with an is_home workspace.
--   2. No migration in this repo drops that trigger, but `pg_trigger` on prod shows it
--      missing. Out-of-band manual DDL removed it.
--   3. `create_business_organization` RPC inserts a single team workspace without
--      `is_home` or `is_default`, relying on the trigger to fill in the gap. Without the
--      trigger, new orgs ship with zero home workspaces and break cross-org copy/move.
--   4. One prod org (22c98dba — "Lead Gen Jay") is currently in this broken state.
--
-- Fix shape (Option D — single workspace, no double-insert collision):
--   1. Restore `tr_ensure_home_workspace` so direct org INSERTs (tests, migrations, future
--      code paths) still get a home workspace.
--   2. Have `create_business_organization` RPC NOT insert a second workspace — instead,
--      let the trigger create the home workspace, then UPDATE its name to the user-chosen
--      name. Avoids colliding with the workspaces_is_home_idx unique partial index.
--   3. Backfill any existing business org that lacks a home workspace by promoting its
--      sole/oldest workspace to is_home=TRUE, is_default=TRUE.
--
-- Author: Andrew Naegele (via Claude)
-- Date: 2026-05-28

-- ============================================================================
-- 1. RECREATE ensure_home_workspace() — single workspace with home + default flags
-- ============================================================================
-- Fires AFTER INSERT ON organizations. Personal orgs are skipped (handle_new_user
-- already creates 'My Calls' with is_home=TRUE). Business orgs get a default
-- 'Home Workspace' that the RPC may later rename to the user-supplied name.
CREATE OR REPLACE FUNCTION public.ensure_home_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'personal' THEN
    RETURN NEW;
  END IF;

  -- Defensive: skip if a workspace somehow already exists for this org (e.g. a future
  -- code path that inserts org + workspace in the same transaction order).
  IF EXISTS (SELECT 1 FROM workspaces WHERE organization_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO workspaces (organization_id, name, workspace_type, is_home, is_default)
  VALUES (NEW.id, 'Home Workspace', 'team', TRUE, TRUE);

  RETURN NEW;
END;
$$;

-- Recreate the trigger binding (the function was alive but the trigger DDL was missing).
DROP TRIGGER IF EXISTS tr_ensure_home_workspace ON organizations;
CREATE TRIGGER tr_ensure_home_workspace
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION ensure_home_workspace();

-- ============================================================================
-- 2. UPDATE create_business_organization() RPC to use the trigger-created workspace
-- ============================================================================
-- Before: created its own second team workspace with no is_home / is_default flags.
-- This worked only when the trigger was alive AND only because nothing collided on the
-- is_home unique partial index (the RPC didn't set is_home=TRUE).
--
-- After: the trigger creates exactly one home + default workspace per business org.
-- The RPC reads its id back, renames it to the user-chosen name if one was supplied,
-- and creates the workspace_membership row. One workspace, both flags set, no
-- unique-index collisions, idempotent against the trigger.
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

  -- INSERT the org — the AFTER INSERT trigger creates the home+default workspace.
  INSERT INTO organizations (name, type, cross_org_default, logo_url)
  VALUES (v_name, 'business', v_cross_org_default, p_logo_url)
  RETURNING id INTO v_organization_id;

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, v_user_id, 'organization_owner');

  -- The trigger has run by this point; grab the home workspace it just created
  -- and rename it to the user-supplied (or fallback) name.
  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE workspaces.organization_id = v_organization_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    -- Safety net: if for any reason the trigger didn't fire (e.g. it gets dropped
    -- again out-of-band), create the workspace inline so the RPC never returns a
    -- broken org. This duplicates the trigger's intent so both paths stay correct.
    INSERT INTO workspaces (organization_id, name, workspace_type, is_home, is_default)
    VALUES (v_organization_id, v_workspace_name, 'team', TRUE, TRUE)
    RETURNING id INTO v_workspace_id;
  ELSE
    UPDATE workspaces
    SET name = v_workspace_name
    WHERE id = v_workspace_id;
  END IF;

  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'workspace_owner');

  organization_id := v_organization_id;
  workspace_id := v_workspace_id;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.create_business_organization(text, text, text, text) IS
  'Creates a business organization with owner membership. The home workspace is created by the tr_ensure_home_workspace trigger (is_home=TRUE, is_default=TRUE) and renamed by this RPC to the user-supplied name. A safety-net inline INSERT fires if the trigger is somehow absent.';

-- ============================================================================
-- 3. BACKFILL orgs that currently lack a home workspace
-- ============================================================================
-- Promote the sole/oldest workspace per org to is_home=TRUE, is_default=TRUE.
-- This rescues "Lead Gen Jay" (the one prod org Andrew created in the gap) plus any
-- other business org that lost the trigger and never had a home workspace assigned.
-- Personal orgs are out of scope here — they go through handle_new_user.
DO $$
DECLARE
  org_row RECORD;
  promote_ws_id UUID;
BEGIN
  FOR org_row IN
    SELECT o.id AS org_id
    FROM organizations o
    WHERE o.type = 'business'
      AND NOT EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.organization_id = o.id AND w.is_home = TRUE
      )
  LOOP
    -- Pick the oldest workspace for the org. Tie-break by id for determinism.
    SELECT id INTO promote_ws_id
    FROM workspaces
    WHERE organization_id = org_row.org_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF promote_ws_id IS NOT NULL THEN
      UPDATE workspaces
      SET is_home = TRUE,
          is_default = TRUE
      WHERE id = promote_ws_id;
    ELSE
      -- Edge case: org has zero workspaces. Create a Home Workspace from scratch.
      INSERT INTO workspaces (organization_id, name, workspace_type, is_home, is_default)
      VALUES (org_row.org_id, 'Home Workspace', 'team', TRUE, TRUE);
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
