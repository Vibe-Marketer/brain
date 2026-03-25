-- PERMISSION MODEL FIX: Remove 'member' from workspace_entries INSERT policy
--
-- Context:
--   'member' = view only (cannot add recordings)
--   'manager' = "Team Member" in UI, can view and add recordings
--
-- The old policy allowed 'member' to INSERT workspace_entries, granting
-- add-recording capability that should be reserved for 'manager' and above.
-- ============================================================================

DROP POLICY IF EXISTS "Workspace members can create entries" ON public.workspace_entries;

CREATE POLICY "Workspace members can create entries"
  ON public.workspace_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('workspace_owner', 'workspace_admin', 'manager')
    )
  );
