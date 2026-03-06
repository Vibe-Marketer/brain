-- Migration: Add index for ai_processing_jobs status queries
-- Purpose: Improve performance of frequent polling queries for active jobs
-- Author: Claude Code
-- Date: 2026-01-28
--
-- The AIProcessingProgress component polls this table every 2 seconds
-- filtering by status IN ('pending', 'processing'). Without an index,
-- this causes full table scans and slow queries (3-4 seconds).

-- ============================================================================
-- INDEX: Optimize status-based queries
-- ============================================================================
-- This partial index only includes rows where status is 'pending' or 'processing'
-- which are the only statuses queried by the polling mechanism.
-- This makes the index smaller and faster to scan.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_processing_jobs') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_processing_jobs_active_status
      ON ai_processing_jobs (status, created_at DESC)
      WHERE status IN (''pending'', ''processing'')';
    
    EXECUTE 'COMMENT ON INDEX idx_ai_processing_jobs_active_status IS
      ''Partial index for efficient polling of active AI processing jobs''';
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
