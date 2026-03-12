-- Migration: Tighten recordings SELECT RLS — scope to workspace membership
-- Purpose: Regular org members should only see recordings they own or that exist
--          in workspaces they belong to. Org admins/owners retain full visibility.
--          Closes #53.
-- Date: 2026-03-08

-- ============================================================================
-- 1. Drop existing SELECT policies from prior tightening attempt
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can view shared recordings in their workspaces" ON recordings;
DROP POLICY IF EXISTS "Users can view recordings in their organizations" ON recordings;
DROP POLICY IF EXISTS "Org admins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Users can view recordings in their workspaces" ON recordings;

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
-- ============================================================================
CREATE POLICY "Users can view recordings in their workspaces"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_entries we
      JOIN workspace_memberships wm ON wm.workspace_id = we.workspace_id
      WHERE we.recording_id = recordings.id
        AND wm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Performance: index on workspace_entries(recording_id)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_entries_recording_id
  ON workspace_entries (recording_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
