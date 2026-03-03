-- Drop the overly broad policy
DROP POLICY IF EXISTS "Users can view recordings in their organizations" ON recordings;

-- Users can ALWAYS see their own recordings
CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (owner_user_id = auth.uid());

-- Users can see recordings shared into workspaces they belong to
CREATE POLICY "Users can view shared recordings in their workspaces"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_entries we
      JOIN workspace_memberships wm ON wm.workspace_id = we.workspace_id
      WHERE we.recording_id = recordings.id
        AND wm.user_id = auth.uid()
    )
  );
