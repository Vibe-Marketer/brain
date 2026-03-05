-- Migration: Rename archived Fathom tables to raw naming convention
-- Purpose: fathom_calls_archive → fathom_raw_calls, fathom_transcripts → fathom_raw_transcripts
--          Adds recording_id UUID FK to link fathom_raw_calls to the canonical recordings table.
-- Date: 2026-03-03

SET lock_timeout = '5s';

-- ============================================================================
-- RENAME fathom_calls_archive → fathom_raw_calls
-- ============================================================================
ALTER TABLE fathom_calls_archive RENAME TO fathom_raw_calls;

COMMENT ON TABLE fathom_raw_calls IS
  'Raw Fathom call data. Source-specific schema preserved for detail views.
   Linked to canonical recordings table via canonical_recording_id FK.
   Renamed from fathom_calls_archive (originally fathom_calls). 2026-03-03.';

-- ============================================================================
-- ADD canonical_recording_id FK to fathom_raw_calls
-- ============================================================================
-- This links raw Fathom data to the canonical recordings table
ALTER TABLE fathom_raw_calls
  ADD COLUMN IF NOT EXISTS canonical_recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fathom_raw_calls_canonical_recording_id
  ON fathom_raw_calls (canonical_recording_id)
  WHERE canonical_recording_id IS NOT NULL;

-- Backfill: link fathom_raw_calls to recordings via legacy_recording_id
UPDATE fathom_raw_calls frc
SET canonical_recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = frc.recording_id
  AND r.source_app = 'fathom'
  AND frc.canonical_recording_id IS NULL;

-- ============================================================================
-- RENAME fathom_transcripts → fathom_raw_transcripts
-- ============================================================================
ALTER TABLE fathom_transcripts RENAME TO fathom_raw_transcripts;

COMMENT ON TABLE fathom_raw_transcripts IS
  'Raw Fathom transcript segments. Per-speaker timestamped segments from Fathom API.
   Supports user edits (edited_text, edited_speaker_name). Renamed from fathom_transcripts. 2026-03-03.';

-- ============================================================================
-- FIX RLS POLICIES on fathom_raw_transcripts
-- ============================================================================
-- The old policies referenced fathom_calls by name — those broke when fathom_calls
-- was renamed to fathom_calls_archive. Now fix them to reference fathom_raw_calls.

-- Drop old policies (may reference stale table name)
DROP POLICY IF EXISTS "Users can read transcripts for own calls" ON fathom_raw_transcripts;
DROP POLICY IF EXISTS "Users can update transcripts for own calls" ON fathom_raw_transcripts;
DROP POLICY IF EXISTS "Service role can manage fathom_transcripts" ON fathom_raw_transcripts;
-- Also try the old table name variants
DROP POLICY IF EXISTS "Users can read transcripts for own calls" ON fathom_transcripts;
DROP POLICY IF EXISTS "Users can update transcripts for own calls" ON fathom_transcripts;

-- Recreate with correct table reference
CREATE POLICY "Users can read own fathom transcripts"
  ON fathom_raw_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fathom_raw_calls frc
      WHERE frc.recording_id = fathom_raw_transcripts.recording_id
        AND frc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own fathom transcripts"
  ON fathom_raw_transcripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fathom_raw_calls frc
      WHERE frc.recording_id = fathom_raw_transcripts.recording_id
        AND frc.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage fathom_raw_transcripts"
  ON fathom_raw_transcripts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RE-ENABLE RLS on fathom_raw_calls (was disabled when archived)
-- ============================================================================
ALTER TABLE fathom_raw_calls ENABLE ROW LEVEL SECURITY;

-- Basic RLS: users can view their own raw calls
CREATE POLICY "Users can view own fathom raw calls"
  ON fathom_raw_calls FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage fathom_raw_calls"
  ON fathom_raw_calls
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
