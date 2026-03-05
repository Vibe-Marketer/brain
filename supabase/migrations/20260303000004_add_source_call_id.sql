-- Migration: Add source_call_id to recordings
-- Purpose: Adds a dedicated column for source-specific external IDs, replacing the need
--          to fish them out of source_metadata JSONB. Enables proper dedup constraint.
-- Date: 2026-03-03

-- ============================================================================
-- COLUMN ADDITION
-- ============================================================================
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS source_call_id TEXT;

-- ============================================================================
-- BACKFILL from source_metadata->>'external_id'
-- ============================================================================
UPDATE recordings
SET source_call_id = source_metadata->>'external_id'
WHERE source_metadata->>'external_id' IS NOT NULL
  AND source_call_id IS NULL;

-- ============================================================================
-- UNIQUE CONSTRAINT for deduplication
-- ============================================================================
-- Prevents duplicate imports: same source + same external ID within an org
ALTER TABLE recordings ADD CONSTRAINT recordings_source_dedup
  UNIQUE (organization_id, source_app, source_call_id);

-- ============================================================================
-- INDEX for fast lookups by source_call_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_recordings_source_call_id
  ON recordings (source_call_id)
  WHERE source_call_id IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
