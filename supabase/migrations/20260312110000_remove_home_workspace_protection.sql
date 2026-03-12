-- Migration: Remove home workspace entry protection
--
-- Design change: HOME view queries recordings directly (by owner_user_id / org),
-- not via workspace_entries. So the home workspace no longer needs to be an
-- immutable source of truth — it's just the default landing workspace.
--
-- Recordings can now be freely removed from any workspace including the home
-- workspace. The recording itself persists and always appears in HOME view.
--
-- Removes:
--   1. protect_home_workspace_entries trigger + function (blocks DELETE on home entries)
--   2. trg_workspace_entries_immutable_home_keys trigger + function (blocks UPDATE of home keys)
--   3. RLS policies that blocked DELETE on home workspace entries
--   4. GUC guard (callvault.allow_home_entry_delete) no longer needed in delete_recording
--
-- Date: 2026-03-12

BEGIN;

-- =============================================================================
-- 1. Drop the BEFORE DELETE trigger that blocked home workspace entry removal
-- =============================================================================

DROP TRIGGER IF EXISTS protect_home_workspace_entries ON workspace_entries;
DROP FUNCTION IF EXISTS prevent_home_workspace_entry_delete();

-- =============================================================================
-- 2. Drop the BEFORE UPDATE trigger that blocked key-column changes on home entries
-- =============================================================================

DROP TRIGGER IF EXISTS trg_workspace_entries_immutable_home_keys ON workspace_entries;
DROP FUNCTION IF EXISTS workspace_entries_immutable_home_keys();

-- =============================================================================
-- 3. Restore workspace_entries DELETE RLS — allow deletion from any workspace
--    (home or not), as long as the user is an admin/owner or owns the recording.
-- =============================================================================

DROP POLICY IF EXISTS "Workspace admins can delete entries from non-home workspaces" ON workspace_entries;
CREATE POLICY "Workspace admins can delete entries"
  ON workspace_entries FOR DELETE
  USING (
    is_workspace_admin_or_owner(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete own entries from non-home workspaces" ON workspace_entries;
CREATE POLICY "Members can delete own entries"
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
  );

-- =============================================================================
-- 4. Update delete_recording — remove the GUC bypass (no longer needed)
--    The trigger it was bypassing no longer exists.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_recording(p_recording_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id UUID;
  v_deleted_workspace_entries INT;
  v_deleted_folder_assignments INT;
  v_deleted_tag_assignments INT;
BEGIN
  -- 1. Verify caller owns the recording
  SELECT owner_user_id INTO v_owner_user_id
  FROM recordings
  WHERE id = p_recording_id;

  IF v_owner_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Recording not found');
  END IF;

  IF v_owner_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized — you do not own this recording');
  END IF;

  -- 2. Remove all workspace_entries for this recording
  DELETE FROM workspace_entries
  WHERE recording_id = p_recording_id;
  GET DIAGNOSTICS v_deleted_workspace_entries = ROW_COUNT;

  -- 3. Remove folder_assignments (legacy Fathom BIGINT FK via legacy_recording_id)
  DELETE FROM folder_assignments fa
  USING recordings r
  WHERE r.id = p_recording_id
    AND fa.call_recording_id = r.legacy_recording_id
    AND r.legacy_recording_id IS NOT NULL;
  GET DIAGNOSTICS v_deleted_folder_assignments = ROW_COUNT;

  -- 4. Remove call_tag_assignments (UUID recording_id after 20260310125000)
  DELETE FROM call_tag_assignments
  WHERE recording_id = p_recording_id;
  GET DIAGNOSTICS v_deleted_tag_assignments = ROW_COUNT;

  -- 5. Delete the recording itself (cascades to transcript_chunks)
  DELETE FROM recordings WHERE id = p_recording_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_recording_id', p_recording_id,
    'cleaned_up', jsonb_build_object(
      'workspace_entries', v_deleted_workspace_entries,
      'folder_assignments', v_deleted_folder_assignments,
      'tag_assignments', v_deleted_tag_assignments
    )
  );
END;
$$;

COMMENT ON FUNCTION public.delete_recording(UUID) IS
  'Safely deletes a recording and all related workspace_entries, folder_assignments, '
  'and call_tag_assignments. Verifies caller ownership. SECURITY DEFINER bypasses RLS '
  'for cascade cleanup. No GUC guard needed — home workspace entries are no longer protected.';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

COMMIT;
