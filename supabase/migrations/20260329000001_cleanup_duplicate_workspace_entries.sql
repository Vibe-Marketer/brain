-- Migration: Clean up duplicate workspace_entries
-- Purpose: Recordings routed by apply-routing-rules may have stale entries
-- in the personal workspace (MY CALLS) because the delete step was non-fatal.
-- This removes duplicates, keeping only the routed workspace entry.
--
-- Logic: For recordings that have source_metadata->>'routed_by_rule_id' set
-- (meaning they were successfully routed), delete any workspace_entries that
-- point to a DIFFERENT workspace than the one the rule routed them to.

-- Step 1: Delete stale personal-workspace entries for routed recordings
-- A recording that was routed to workspace X should NOT also appear in workspace Y
DELETE FROM workspace_entries we
WHERE EXISTS (
  SELECT 1 FROM recordings r
  WHERE r.id = we.recording_id
  AND r.source_metadata->>'routed_by_rule_id' IS NOT NULL
)
AND NOT EXISTS (
  -- Keep the entry if it matches a routing rule's target
  -- (the workspace_entry created by apply-routing-rules)
  SELECT 1 FROM workspace_entries we2
  WHERE we2.recording_id = we.recording_id
  AND we2.workspace_id != we.workspace_id
  AND we2.created_at >= we.created_at
);

-- Step 2: For recordings with multiple workspace_entries where one is in a
-- personal workspace and another in a named workspace, remove the personal one.
-- This catches cases where the routing trace wasn't stamped but the move happened.
WITH duplicates AS (
  SELECT we.id, we.recording_id, we.workspace_id,
    w.workspace_type,
    ROW_NUMBER() OVER (
      PARTITION BY we.recording_id
      ORDER BY
        CASE WHEN w.workspace_type = 'personal' THEN 1 ELSE 0 END, -- personal last
        we.created_at DESC -- newest first
    ) as rn
  FROM workspace_entries we
  JOIN workspaces w ON w.id = we.workspace_id
  WHERE we.recording_id IN (
    SELECT recording_id FROM workspace_entries
    GROUP BY recording_id HAVING COUNT(*) > 1
  )
)
DELETE FROM workspace_entries
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
