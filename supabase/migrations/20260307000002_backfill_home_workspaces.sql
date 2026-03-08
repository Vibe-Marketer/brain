-- Phase 8: Backfill Home Workspaces

-- For existing organizations, ensure at least one workspace is marked as is_home.
-- We prioritize 'personal' workspaces with is_default if they exist.

DO $$
DECLARE
  v_org RECORD;
  v_workspace_id UUID;
BEGIN
  -- Loop through organizations that DON'T have a home workspace
  FOR v_org IN 
    SELECT id FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.organization_id = o.id AND w.is_home = TRUE)
  LOOP
    -- 1. Try to find a personal default workspace
    SELECT id INTO v_workspace_id
    FROM workspaces
    WHERE organization_id = v_org.id
      AND workspace_type = 'personal'
      AND is_default = TRUE
    LIMIT 1;

    -- 2. If no personal default, try any personal workspace
    IF v_workspace_id IS NULL THEN
      SELECT id INTO v_workspace_id
      FROM workspaces
      WHERE organization_id = v_org.id
        AND workspace_type = 'personal'
      LIMIT 1;
    END IF;

    -- 3. If still no personal, try any workspace
    IF v_workspace_id IS NULL THEN
      SELECT id INTO v_workspace_id
      FROM workspaces
      WHERE organization_id = v_org.id
      LIMIT 1;
    END IF;

    -- If we found a workspace, mark it as is_home
    IF v_workspace_id IS NOT NULL THEN
      UPDATE workspaces SET is_home = TRUE WHERE id = v_workspace_id;
      RAISE NOTICE 'Marked workspace % as HOME for organization %', v_workspace_id, v_org.id;
    END IF;
  END LOOP;
END;
$$;
