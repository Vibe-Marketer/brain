-- Migration: Protect HOME workspace entries from deletion
--
-- Every recording in an org must always appear in the HOME workspace (is_home=true).
-- Recordings cannot be removed from HOME — only deleting the recording itself is allowed.
--
-- Implementation:
-- 1. BEFORE DELETE trigger on workspace_entries checks is_home and raises an exception
--    for direct deletes (e.g. user-initiated "Remove from workspace" actions).
-- 2. The trigger allows deletion when the session GUC callvault.allow_home_entry_delete
--    is set to 'true'. The delete_recording RPC sets this before its cleanup step.
-- 3. delete_recording is updated to set the GUC before deleting workspace_entries,
--    so recording deletion still works end-to-end.
--
-- Closes: #100

-- ============================================================================
-- 1. Trigger function with GUC bypass for recording deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_home_workspace_entry_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow deletion when initiated by delete_recording (or another trusted caller)
  -- that sets the session-local GUC callvault.allow_home_entry_delete = 'true'.
  IF current_setting('callvault.allow_home_entry_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- Block direct deletion of HOME workspace entries.
  IF (SELECT is_home FROM workspaces WHERE id = OLD.workspace_id) THEN
    RAISE EXCEPTION
      'Cannot remove a recording from the HOME workspace. '
      'Delete the recording itself to remove it from the org.';
  END IF;

  RETURN OLD;
END;
$$;

-- ============================================================================
-- 2. Attach trigger to workspace_entries
-- ============================================================================

DROP TRIGGER IF EXISTS protect_home_workspace_entries ON workspace_entries;

CREATE TRIGGER protect_home_workspace_entries
  BEFORE DELETE ON workspace_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_home_workspace_entry_delete();

-- ============================================================================
-- 3. Update delete_recording RPC to set the GUC before cleanup
--    This allows the RPC to delete HOME workspace entries as part of
--    a full recording deletion without triggering the protection trigger.
-- ============================================================================

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
  v_deleted_call_tags INT;
BEGIN
  -- -----------------------------------------------------------------------
  -- 1. Verify caller owns the recording
  -- -----------------------------------------------------------------------
  SELECT owner_user_id INTO v_owner_user_id
  FROM recordings
  WHERE id = p_recording_id;

  IF v_owner_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Recording not found');
  END IF;

  IF v_owner_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized — you do not own this recording');
  END IF;

  -- -----------------------------------------------------------------------
  -- 2. Signal that this deletion is authorised — allows HOME entries to be
  --    removed as part of a full recording delete (bypasses the trigger guard).
  --    SET LOCAL is transaction-scoped and resets automatically on COMMIT/ROLLBACK.
  -- -----------------------------------------------------------------------
  SET LOCAL callvault.allow_home_entry_delete = 'true';

  -- -----------------------------------------------------------------------
  -- 3. Remove workspace_entries referencing this recording
  -- -----------------------------------------------------------------------
  DELETE FROM workspace_entries
  WHERE recording_id = p_recording_id;

  GET DIAGNOSTICS v_deleted_workspace_entries = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 4. Remove folder_assignments referencing this recording (legacy FK)
  --    folder_assignments uses legacy_recording_id (bigint), so look it up.
  -- -----------------------------------------------------------------------
  DELETE FROM folder_assignments fa
  USING recordings r
  WHERE r.id = p_recording_id
    AND fa.call_recording_id = r.legacy_recording_id;

  GET DIAGNOSTICS v_deleted_folder_assignments = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 5. Remove call_tags referencing this recording (legacy FK)
  -- -----------------------------------------------------------------------
  DELETE FROM call_tags ct
  USING recordings r
  WHERE r.id = p_recording_id
    AND ct.recording_id = r.legacy_recording_id;

  GET DIAGNOSTICS v_deleted_call_tags = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 6. Delete the recording itself
  --    FK cascades on recordings will clean up:
  --      - transcript_chunks (ON DELETE CASCADE via recording_id)
  --      - Any other tables with direct FK to recordings.id
  -- -----------------------------------------------------------------------
  DELETE FROM recordings WHERE id = p_recording_id;

  -- -----------------------------------------------------------------------
  -- 7. Return summary
  -- -----------------------------------------------------------------------
  RETURN jsonb_build_object(
    'success', true,
    'deleted_recording_id', p_recording_id,
    'cleaned_up', jsonb_build_object(
      'workspace_entries', v_deleted_workspace_entries,
      'folder_assignments', v_deleted_folder_assignments,
      'call_tags', v_deleted_call_tags
    )
  );
END;
$$;

COMMENT ON FUNCTION prevent_home_workspace_entry_delete IS
  'Blocks direct deletion of workspace_entries rows when the workspace is HOME (is_home=true). '
  'Allows deletion when callvault.allow_home_entry_delete session GUC is set (used by delete_recording). '
  'Enforces the invariant that every recording always appears in HOME.';

COMMENT ON FUNCTION public.delete_recording(UUID) IS
  'Safely deletes a recording and all related workspace_entries, folder_assignments, and call_tags. '
  'Verifies caller ownership. SECURITY DEFINER bypasses RLS for cascade cleanup. '
  'Sets callvault.allow_home_entry_delete = true to permit HOME workspace entry deletion. '
  'Closes #57, updated by #100.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
