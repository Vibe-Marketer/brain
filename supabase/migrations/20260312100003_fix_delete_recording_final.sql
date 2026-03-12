-- Migration: Fix delete_recording — use current column names after UUID migration
-- After 20260310125000_migrate_call_recording_id_to_uuid.sql:
--   call_tag_assignments.call_recording_id (BIGINT) was dropped
--   call_tag_assignments.recording_id (UUID) was added
-- Also: folder_assignments.call_recording_id needs same check
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

  -- 2. Allow HOME workspace entry deletion
  SET LOCAL callvault.allow_home_entry_delete = 'true';

  -- 3. Remove workspace_entries
  DELETE FROM workspace_entries
  WHERE recording_id = p_recording_id;
  GET DIAGNOSTICS v_deleted_workspace_entries = ROW_COUNT;

  -- 4. Remove folder_assignments (legacy Fathom BIGINT FK via legacy_recording_id)
  DELETE FROM folder_assignments fa
  USING recordings r
  WHERE r.id = p_recording_id
    AND fa.call_recording_id = r.legacy_recording_id
    AND r.legacy_recording_id IS NOT NULL;
  GET DIAGNOSTICS v_deleted_folder_assignments = ROW_COUNT;

  -- 5. Remove call_tag_assignments (now uses UUID recording_id after 20260310125000)
  DELETE FROM call_tag_assignments
  WHERE recording_id = p_recording_id;
  GET DIAGNOSTICS v_deleted_tag_assignments = ROW_COUNT;

  -- 6. Delete the recording itself (cascades to transcript_chunks)
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
  'and call_tag_assignments. Uses UUID recording_id (migrated in 20260310125000). '
  'Verifies caller ownership. SECURITY DEFINER bypasses RLS for cascade cleanup.';
