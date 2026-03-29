-- Migration: Restore workspace_entries deleted by broken migration 20260329000001
--
-- The previous migration incorrectly deleted workspace_entries for recordings
-- that only had a single entry. This restores entries by re-creating them
-- from the recordings table, assigning each recording to its organization's
-- personal workspace (the default destination).
--
-- Recordings that already have a workspace_entry are skipped.

-- Step 1: Restore missing workspace_entries
-- For every recording that has NO workspace_entry, create one in the
-- organization's personal workspace.
INSERT INTO workspace_entries (workspace_id, recording_id)
SELECT w.id, r.id
FROM recordings r
JOIN workspaces w ON w.organization_id = r.organization_id
  AND w.workspace_type = 'personal'
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entries we
  WHERE we.recording_id = r.id
)
ON CONFLICT DO NOTHING;

-- Step 2: For recordings with source_metadata->>'routed_by_rule_id' set,
-- check if they should be in a different workspace based on the routing rule.
-- Re-run routing for these by looking at import_routing_rules to find the
-- target workspace. But this is complex — for now just ensure every recording
-- has at least ONE workspace_entry (Step 1 above handles this).
-- The user can re-run "Apply Now" in the Rules page to re-route correctly.
