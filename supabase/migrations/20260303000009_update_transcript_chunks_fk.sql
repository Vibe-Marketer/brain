-- Migration: Add canonical_recording_id UUID FK to transcript_chunks
-- Purpose: transcript_chunks currently uses recording_id BIGINT (legacy FK to fathom_calls).
--          This adds a UUID FK to the canonical recordings table alongside the existing column.
-- Date: 2026-03-03

-- ============================================================================
-- ADD UUID FK COLUMN
-- ============================================================================
ALTER TABLE transcript_chunks
  ADD COLUMN IF NOT EXISTS canonical_recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL;

-- ============================================================================
-- BACKFILL: Join through recordings.legacy_recording_id
-- ============================================================================
UPDATE transcript_chunks tc
SET canonical_recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = tc.recording_id
  AND tc.canonical_recording_id IS NULL;

-- ============================================================================
-- INDEX for the new FK
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_canonical_recording_id
  ON transcript_chunks (canonical_recording_id)
  WHERE canonical_recording_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN transcript_chunks.canonical_recording_id IS
  'UUID FK to canonical recordings table. Replaces legacy BIGINT recording_id FK.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
