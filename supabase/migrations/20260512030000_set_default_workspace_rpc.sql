-- Phase 36-01 BUG-02: Atomic set_default_workspace RPC
--
-- Replaces the 3-query client-side flow in useSetDefaultWorkspace that was
-- triggering HTTP 406 PGRST116 ("JSON object requested, multiple (or no) rows returned")
-- when toggling the default workspace from the Workspace Detail panel.
--
-- The fix moves the unset-others + set-target sequence into a single atomic
-- SQL function. The client now calls supabase.rpc('set_default_workspace', ...)
-- once and gets back the updated row.

CREATE OR REPLACE FUNCTION public.set_default_workspace(p_workspace_id uuid)
RETURNS workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('org_owner', 'org_admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized — caller % cannot set default workspace for org %', auth.uid(), v_org_id
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Atomically unset is_default on every other workspace in this org.
  -- No .select(), no .single() — pure UPDATE, never returns rows to the client.
  UPDATE workspaces
  SET is_default = false
  WHERE organization_id = v_org_id
    AND is_default = true
    AND id <> p_workspace_id;

  -- Set the target as default and return it. This is the only row returned.
  UPDATE workspaces
  SET is_default = true
  WHERE id = p_workspace_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_workspace(uuid) TO authenticated;

COMMENT ON FUNCTION public.set_default_workspace(uuid)
  IS 'Atomically sets the given workspace as the default for its org. Phase 36-01 BUG-02 fix. Replaces the 3-query client flow that triggered HTTP 406 PGRST116.';
