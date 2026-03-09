-- Migration: Workspace entries home-workspace guard
-- Purpose:   Issue #95 — Add/remove call from workspace
--            1. Tighten DELETE RLS on workspace_entries so regular users
--               cannot remove recordings from the home workspace via RLS.
--               (SECURITY DEFINER functions such as delete_recording bypass RLS
--               and are therefore unaffected by this change.)
--            2. Verify INSERT RLS already allows workspace members to add calls.
--               (No change needed — "Workspace members can create entries" exists.)
--            3. The recording FK (workspace_entries.recording_id -> recordings.id
--               ON DELETE CASCADE) means deleting a workspace_entry row never
--               deletes the underlying recording — this is correct by design.
-- Closes:    #95 (backend requirements)
-- Date:      2026-03-10

BEGIN;

-- =============================================================================
-- 1. Tighten workspace_entries DELETE to block home-workspace removals
--    via RLS (protects against accidental client-side misuse).
-- =============================================================================

DROP POLICY IF EXISTS "Workspace admins can delete entries" ON workspace_entries;
CREATE POLICY "Workspace admins can delete entries from non-home workspaces"
  ON workspace_entries FOR DELETE
  USING (
    is_workspace_admin_or_owner(workspace_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM workspaces WHERE id = workspace_id AND is_home = true
    )
  );

DROP POLICY IF EXISTS "Members can delete own entries" ON workspace_entries;
CREATE POLICY "Members can delete own entries from non-home workspaces"
  ON workspace_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('member', 'manager')
    )
    AND EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = workspace_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspaces WHERE id = workspace_id AND is_home = true
    )
  );

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

COMMIT;
