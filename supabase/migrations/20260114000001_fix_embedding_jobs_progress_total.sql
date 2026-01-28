-- Migration: Fix embedding_jobs progress_total to match queue_total
-- Purpose: Sync progress_total with queue_total for accurate progress display
-- Author: Claude Sonnet 4.5
-- Date: 2026-01-14

-- ============================================================================
-- FIX EXISTING JOBS
-- ============================================================================
-- Update all existing embedding_jobs to sync progress_total with queue_total
-- This fixes the issue where UI shows conflicting counts like:
-- "12 transcripts ready to index" vs "Processing 1 of 933"

UPDATE embedding_jobs
SET progress_total = queue_total
WHERE progress_total != queue_total
  AND queue_total IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN embedding_jobs.progress_total IS 'Total number of recordings to process (should match queue_total)';
COMMENT ON COLUMN embedding_jobs.queue_total IS 'Total number of queue entries for this job (source of truth for count)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
