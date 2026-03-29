-- Migration: Reset routing stamps so Apply Now can re-process all recordings
--
-- Context: Migration 20260329000001 incorrectly deleted workspace_entries.
-- Migration 20260329000002 restored them but without folder_id.
-- The routing stamps (source_metadata->>'routed_by_rule_id') prevent
-- apply-routing-rules from re-processing these recordings.
--
-- This migration clears the routing stamps so the user can click
-- "Apply Now" on the Rules page to re-route everything correctly,
-- restoring the proper workspace AND folder assignments.

-- Clear routing trace from source_metadata for all recordings
-- that were previously routed (so they can be re-routed)
UPDATE recordings
SET source_metadata = source_metadata - 'routed_by_rule_id'
                                      - 'routed_by_rule_name'
                                      - 'routed_at'
                                      - 'routed_retroactively'
WHERE source_metadata->>'routed_by_rule_id' IS NOT NULL;
