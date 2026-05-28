-- Fix typo in set_default_workspace RPC: `organization_members` does not exist.
-- The canonical table name is `organization_memberships`.
--
-- Symptom: HTTP 404 / Postgres 42P01 (`relation "organization_members" does not exist`)
-- thrown when a caller who is NOT a workspace_owner on the target workspace falls
-- through to the org-admin / org-owner fallback authz path.
--
-- Created by Phase 36-01 BUG-02 migration (`20260524130000_set_default_workspace_atomic_rpc.sql`).
-- Reported: 2026-05-28 by Andrew via 404 on /rest/v1/rpc/set_default_workspace.
--
-- Fix: rewrite the RPC with the correct table name. SECURITY DEFINER preserved.
-- search_path locked to 'public', 'pg_temp'. Idempotent CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.set_default_workspace(p_workspace_id uuid)
RETURNS workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid;
  v_updated workspaces;
BEGIN
  -- Look up the org this workspace belongs to
  SELECT organization_id INTO v_org_id
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'workspace % not found', p_workspace_id
      USING ERRCODE = '42704';  -- undefined_object
  END IF;

  -- Authz check: caller must be workspace_owner on the target, OR
  --              org_owner / org_admin on the parent org.
  IF NOT EXISTS (
    SELECT 1 FROM workspace_memberships wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('workspace_owner', 'org_admin', 'org_owner')
  ) AND NOT EXISTS (
    SELECT 1 FROM organization_memberships om   -- FIXED: was organization_members
    WHERE om.organization_id = v_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('org_owner', 'org_admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized — caller % cannot set default workspace for org %', auth.uid(), v_org_id
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Atomically unset is_default on every other workspace in this org.
  UPDATE workspaces
  SET is_default = false
  WHERE organization_id = v_org_id
    AND is_default = true
    AND id <> p_workspace_id;

  -- Set the target as default and return it.
  UPDATE workspaces
  SET is_default = true
  WHERE id = p_workspace_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$function$;
