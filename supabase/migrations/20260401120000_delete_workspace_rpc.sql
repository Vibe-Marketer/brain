-- Migration: Add delete_workspace RPC
-- Purpose: Workspace deletion was blocked by the prevent_last_workspace_owner_removal
--   trigger. When a user deletes a workspace they own, the CASCADE delete of
--   workspace_memberships fires the trigger, which raises "Cannot remove the last
--   workspace owner." This RPC handles workspace deletion correctly by:
--   1. Verifying the caller is a workspace_owner
--   2. Optionally transferring recordings to another workspace
--   3. Releasing any un-transferred workspace_entries (deletes them)
--   4. Explicitly deleting workspace_memberships with the trigger temporarily disabled
--   5. Deleting the workspace row itself
-- Date: 2026-04-01

-- ============================================================================
-- RPC: delete_workspace
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_workspace(
  p_workspace_id UUID,
  p_transfer_to_workspace_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_org_id UUID;
BEGIN
  -- 1. Verify the caller is a workspace_owner
  SELECT role INTO v_caller_role
  FROM workspace_memberships
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this workspace.';
  END IF;

  IF v_caller_role <> 'workspace_owner' THEN
    RAISE EXCEPTION 'Only workspace owners can delete a workspace.';
  END IF;

  -- 2. Get the organization_id for validation
  SELECT organization_id INTO v_org_id
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found.';
  END IF;

  -- 3. If transferring recordings, move workspace_entries to the target workspace
  IF p_transfer_to_workspace_id IS NOT NULL
     AND p_transfer_to_workspace_id <> p_workspace_id THEN
    -- Verify target workspace exists and belongs to the same organization
    IF NOT EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = p_transfer_to_workspace_id
        AND organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'Target workspace not found or belongs to a different organization.';
    END IF;

    UPDATE workspace_entries
    SET workspace_id = p_transfer_to_workspace_id,
        folder_id = NULL  -- Clear folder assignment since folder belongs to old workspace
    WHERE workspace_id = p_workspace_id;
  END IF;

  -- 4. Delete remaining workspace_entries (ones not transferred)
  DELETE FROM workspace_entries
  WHERE workspace_id = p_workspace_id;

  -- 5. Disable the last-owner trigger, delete memberships, re-enable trigger
  --    This is safe because we are deleting the entire workspace, not just removing
  --    a member. The trigger exists to protect against accidentally orphaning a workspace.
  ALTER TABLE workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion;

  DELETE FROM workspace_memberships
  WHERE workspace_id = p_workspace_id;

  ALTER TABLE workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;

  -- 6. Delete the workspace itself (cascades to folders, invite_links, etc.)
  DELETE FROM workspaces
  WHERE id = p_workspace_id;
END;
$$;

COMMENT ON FUNCTION public.delete_workspace(UUID, UUID) IS
  'Safely deletes a workspace. Verifies caller is workspace_owner, optionally transfers recordings, then removes memberships (bypassing last-owner trigger since the workspace itself is being deleted) and the workspace row.';

-- Grant execute to authenticated users (RPC is SECURITY DEFINER, so auth checks are internal)
GRANT EXECUTE ON FUNCTION public.delete_workspace(UUID, UUID) TO authenticated;
