-- Migration: Ensure folder-assigned recordings have workspace_entries in the correct workspace
--
-- Problem: folder_assignments links recordings to folders, but the recordings may
-- not have workspace_entries in the workspace that OWNS those folders. This happens
-- when recordings are in a different org's personal workspace.
--
-- Fix: For each folder_assignment, ensure the recording has a workspace_entry in
-- the folder's parent workspace. Also backfill workspace_entries.folder_id from
-- folder_assignments.

-- Step 1: Create workspace_entries for recordings that are folder-assigned
-- but missing from the folder's workspace
INSERT INTO workspace_entries (workspace_id, recording_id, folder_id)
SELECT DISTINCT f.workspace_id, r.id, fa.folder_id
FROM folder_assignments fa
JOIN recordings r ON r.legacy_recording_id = fa.call_recording_id
JOIN folders f ON f.id = fa.folder_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entries we
  WHERE we.recording_id = r.id
  AND we.workspace_id = f.workspace_id
)
ON CONFLICT (workspace_id, recording_id) DO UPDATE
SET folder_id = EXCLUDED.folder_id;

-- Step 2: For recordings that ARE in the correct workspace but have folder_id = NULL,
-- backfill folder_id from folder_assignments
UPDATE workspace_entries we
SET folder_id = fa.folder_id
FROM folder_assignments fa
JOIN recordings r ON r.legacy_recording_id = fa.call_recording_id
JOIN folders f ON f.id = fa.folder_id
WHERE we.recording_id = r.id
AND we.workspace_id = f.workspace_id
AND we.folder_id IS NULL;
