-- Migration: Add unique constraint on folder_assignments (call_recording_id, folder_id)
-- Purpose: The frontend upserts into folder_assignments with
--   onConflict: 'call_recording_id,folder_id' but the only unique constraint is
--   UNIQUE(folder_id, call_recording_id, user_id) (3 columns). PostgreSQL requires
--   an exact match on the conflict target, so the upsert fails with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
--   This adds the missing 2-column unique constraint. The existing 3-column constraint
--   is kept for backwards compatibility (it also enforces per-user uniqueness).
-- Date: 2026-04-01

-- ============================================================================
-- Add unique constraint
-- ============================================================================

ALTER TABLE folder_assignments
  ADD CONSTRAINT uq_folder_assignments_call_folder
  UNIQUE (call_recording_id, folder_id);
