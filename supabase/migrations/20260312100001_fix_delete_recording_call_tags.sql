-- Migration: Fix delete_recording — wrong table reference for legacy call tags
-- Problem: The function deleted from call_tags (tag definitions table) using
--          ct.recording_id which doesn't exist. The correct table is
--          call_category_assignments (the junction table with call_recording_id).
-- Date: 2026-03-12

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
  --    folder_assignments uses call_recording_id (bigint legacy Fathom ID).
  -- -----------------------------------------------------------------------
  DELETE FROM folder_assignments fa
  USING recordings r
  WHERE r.id = p_recording_id
    AND fa.call_recording_id = r.legacy_recording_id
    AND r.legacy_recording_id IS NOT NULL;

  GET DIAGNOSTICS v_deleted_folder_assignments = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 5. Remove call_category_assignments (legacy tag assignments, by Fathom ID)
  --    NOTE: call_tags is the tag-definition table (no recording_id column).
  --          call_category_assignments is the junction table with call_recording_id.
  -- -----------------------------------------------------------------------
  DELETE FROM call_category_assignments cta
  USING recordings r
  WHERE r.id = p_recording_id
    AND cta.call_recording_id = r.legacy_recording_id
    AND r.legacy_recording_id IS NOT NULL;

  GET DIAGNOSTICS v_deleted_call_tags = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 6. Delete the recording itself
  --    FK cascades on recordings.id will clean up:
  --      - transcript_chunks (via canonical_recording_id FK if present)
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
      'call_category_assignments', v_deleted_call_tags
    )
  );
END;
$$;

COMMENT ON FUNCTION public.delete_recording(UUID) IS
  'Safely deletes a recording and all related workspace_entries, folder_assignments, '
  'and call_category_assignments (legacy Fathom tag assignments). '
  'Verifies caller ownership. SECURITY DEFINER bypasses RLS for cascade cleanup. '
  'Sets callvault.allow_home_entry_delete = true to permit HOME workspace entry deletion. '
  'Closes #57, fixed by #100, corrected call_tags bug 2026-03-12.';
