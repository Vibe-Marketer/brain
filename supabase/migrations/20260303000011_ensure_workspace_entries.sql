-- Phase 5E: Ensure every recording has at least one workspace_entries row
-- Creates a workspace_entry in the user's personal (default) workspace for any
-- recording that doesn't already appear in any workspace.

-- Step 1: Find recordings without any workspace_entries
-- Step 2: For each, find or create the user's personal workspace
-- Step 3: Insert workspace_entries

-- Insert workspace entries for orphaned recordings using the owner's default workspace
INSERT INTO workspace_entries (workspace_id, recording_id, created_at)
SELECT DISTINCT
  w.id AS workspace_id,
  r.id AS recording_id,
  NOW()
FROM recordings r
-- Join to find the owner's default workspace
JOIN workspaces w ON w.organization_id = r.organization_id AND w.is_default = true
-- Only for recordings NOT already in any workspace
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entries we WHERE we.recording_id = r.id
)
-- Avoid duplicates
ON CONFLICT DO NOTHING;
