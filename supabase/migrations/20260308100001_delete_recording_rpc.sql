-- Migration: Add delete_recording RPC
-- Purpose: Provide a safe, cascading recording deletion that cleans up
--          workspace_entries, folder_assignments, and call_tags before
--          removing the recording itself. Replaces direct DELETE which was
--          blocked by the RLS NOT EXISTS(workspace_entries) guard.
-- Closes: #57
-- Date: 2026-03-08

-- ============================================================================
-- 1. Create delete_recording RPC (SECURITY DEFINER)
-- ============================================================================
-- SECURITY DEFINER runs as the function owner (superuser), bypassing RLS.
-- Authorization is enforced explicitly inside the function body.

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
  -- 2. Remove workspace_entries referencing this recording
  -- -----------------------------------------------------------------------
  DELETE FROM workspace_entries
  WHERE recording_id = p_recording_id;

  GET DIAGNOSTICS v_deleted_workspace_entries = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 3. Remove folder_assignments referencing this recording (legacy FK)
  --    folder_assignments uses legacy_recording_id (bigint), so look it up.
  -- -----------------------------------------------------------------------
  DELETE FROM folder_assignments fa
  USING recordings r
  WHERE r.id = p_recording_id
    AND fa.call_recording_id = r.legacy_recording_id;

  GET DIAGNOSTICS v_deleted_folder_assignments = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 4. Remove call_tags referencing this recording (legacy FK)
  -- -----------------------------------------------------------------------
  DELETE FROM call_tags ct
  USING recordings r
  WHERE r.id = p_recording_id
    AND ct.recording_id = r.legacy_recording_id;

  GET DIAGNOSTICS v_deleted_call_tags = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 5. Delete the recording itself
  --    FK cascades on recordings will clean up:
  --      - transcript_chunks (ON DELETE CASCADE via recording_id)
  --      - Any other tables with direct FK to recordings.id
  -- -----------------------------------------------------------------------
  DELETE FROM recordings WHERE id = p_recording_id;

  -- -----------------------------------------------------------------------
  -- 6. Return summary
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

COMMENT ON FUNCTION public.delete_recording(UUID) IS
  'Safely deletes a recording and all related workspace_entries, folder_assignments, and call_tags. '
  'Verifies caller ownership. SECURITY DEFINER bypasses RLS for cascade cleanup. Closes #57.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
