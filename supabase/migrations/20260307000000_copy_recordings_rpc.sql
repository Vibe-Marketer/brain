-- Phase 6: Cross-Organization Copy Logic

CREATE OR REPLACE FUNCTION public.copy_recordings_to_organization(
  p_recording_ids UUID[],
  p_target_organization_id UUID,
  p_remove_source BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recording RECORD;
  v_new_recording_id UUID;
  v_target_home_workspace_id UUID;
  v_copied_count INTEGER := 0;
  v_recording_id UUID;
BEGIN
  -- 0. Permission checks: caller must be a member of the target organization
  IF NOT is_organization_member(p_target_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of target organization';
  END IF;

  -- 1. Get the target organization's HOME workspace
  SELECT id INTO v_target_home_workspace_id
  FROM workspaces
  WHERE organization_id = p_target_organization_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_target_home_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Target organization has no HOME workspace';
  END IF;

  -- 2. Iterate through recordings and copy
  FOREACH v_recording_id IN ARRAY p_recording_ids
  LOOP
    -- Get recording data
    SELECT * INTO v_recording FROM recordings WHERE id = v_recording_id;

    IF v_recording IS NOT NULL THEN
      -- Verify caller owns this recording or is a member of the source org
      IF v_recording.owner_user_id IS DISTINCT FROM auth.uid()
         AND NOT is_organization_member(v_recording.organization_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: no access to recording %', v_recording_id;
      END IF;
      -- Create new recording in target organization
      INSERT INTO recordings (
        organization_id,
        owner_user_id,
        title,
        audio_url,
        video_url,
        full_transcript,
        summary,
        global_tags,
        source_app,
        source_metadata,
        duration,
        recording_start_time,
        recording_end_time,
        created_at,
        synced_at
      )
      VALUES (
        p_target_organization_id,
        auth.uid(), -- The person copying becomes the owner in the target org
        v_recording.title,
        v_recording.audio_url,
        v_recording.video_url,
        v_recording.full_transcript,
        v_recording.summary,
        v_recording.global_tags,
        v_recording.source_app,
        v_recording.source_metadata,
        v_recording.duration,
        v_recording.recording_start_time,
        v_recording.recording_end_time,
        NOW(), -- New created_at for the copy
        v_recording.synced_at
      )
      RETURNING id INTO v_new_recording_id;
      -- Note: the auto_home_workspace_entry trigger on recordings INSERT
      -- automatically creates the workspace_entry in the target HOME workspace.

      -- Optional: Remove from source org (only if caller owns the recording)
      IF p_remove_source THEN
        IF v_recording.owner_user_id IS DISTINCT FROM auth.uid() THEN
          RAISE EXCEPTION 'Access denied: only the owner can remove source recording %', v_recording_id;
        END IF;
        -- Remove workspace entries first so the delete trigger doesn't block
        DELETE FROM workspace_entries WHERE recording_id = v_recording_id;
        DELETE FROM recordings WHERE id = v_recording_id;
      END IF;

      v_copied_count := v_copied_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'copied_count', v_copied_count
  );
END;
$$;
