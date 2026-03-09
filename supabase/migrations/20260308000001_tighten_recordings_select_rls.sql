-- Migration: Tighten recordings SELECT RLS — scope to workspace membership
-- Purpose: Regular org members should only see recordings they own or that exist
--          in workspaces they belong to. Org admins/owners retain full visibility.
--          Also adds org-alignment guard to workspace_entries INSERT to prevent
--          cross-org privilege escalation via crafted workspace_entries rows.
--          Closes #53.
-- Date: 2026-03-08

-- ============================================================================
-- 1. Drop existing SELECT policies from prior tightening attempt
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can view shared recordings in their workspaces" ON recordings;
-- Also drop the original broad policy in case it was re-applied
DROP POLICY IF EXISTS "Users can view recordings in their organizations" ON recordings;

-- ============================================================================
-- 2. Org admins/owners can see ALL recordings in their organization
-- ============================================================================
CREATE POLICY "Org admins can view all recordings"
  ON recordings FOR SELECT
  USING (is_organization_admin_or_owner(organization_id, auth.uid()));

-- ============================================================================
-- 3. Users can always see their own recordings
-- ============================================================================
CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (owner_user_id = auth.uid());

-- ============================================================================
-- 4. Regular members see recordings shared into workspaces they belong to
--    Defense-in-depth: org-alignment predicate prevents cross-org leakage
--    through mis-linked workspace_entries rows.
-- ============================================================================
CREATE POLICY "Users can view recordings in their workspaces"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_entries we
      JOIN workspace_memberships wm ON wm.workspace_id = we.workspace_id
      WHERE we.recording_id = recordings.id
        AND wm.user_id = auth.uid()
        AND get_workspace_organization_id(we.workspace_id) = recordings.organization_id
    )
  );

-- ============================================================================
-- 5. Tighten workspace_entries INSERT to prevent privilege escalation
--    Without this, a workspace member could insert a workspace_entries row
--    referencing a recording from a different org and gain SELECT access to it.
--    Require that the linked recording belongs to the same org as the workspace.
-- ============================================================================
DROP POLICY IF EXISTS "Workspace members can create entries" ON workspace_entries;

CREATE POLICY "Workspace members can create entries"
  ON workspace_entries FOR INSERT
  WITH CHECK (
    -- Must be a workspace member with an active role
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('workspace_owner', 'workspace_admin', 'manager', 'member')
    )
    -- Recording must belong to the same org as the workspace (prevents cross-org linking)
    AND get_recording_organization_id(workspace_entries.recording_id)
          = get_workspace_organization_id(workspace_entries.workspace_id)
  );

-- ============================================================================
-- 6. Performance: ensure index on workspace_entries(recording_id)
--    The table was renamed from vault_entries; PostgreSQL keeps old index names
--    so idx_vault_entries_recording_id may already exist. Rename it if so,
--    then create under the canonical name if it still doesn't exist.
-- ============================================================================
DO $$
BEGIN
  -- Rename legacy index if it exists and the new name does not
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_vault_entries_recording_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_workspace_entries_recording_id'
  ) THEN
    ALTER INDEX idx_vault_entries_recording_id
      RENAME TO idx_workspace_entries_recording_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_entries_recording_id
  ON workspace_entries (recording_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
