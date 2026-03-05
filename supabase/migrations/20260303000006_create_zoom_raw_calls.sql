-- Migration: Create zoom_raw_calls table
-- Purpose: Dedicated raw table for Zoom meeting data, replacing the pattern of
--          stuffing Zoom data into fathom_calls with source_platform='zoom'.
-- Date: 2026-03-03

-- ============================================================================
-- TABLE: zoom_raw_calls
-- ============================================================================
CREATE TABLE zoom_raw_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Zoom-specific identifiers
  zoom_meeting_id TEXT,
  zoom_meeting_uuid TEXT,
  zoom_numeric_id TEXT,

  -- Meeting metadata
  host_email TEXT,
  host_id TEXT,
  account_id TEXT,
  topic TEXT,
  start_time TIMESTAMPTZ,
  duration INTEGER,            -- seconds
  timezone TEXT,
  meeting_type INTEGER,        -- Zoom meeting type code

  -- Recording URLs
  recording_url TEXT,
  share_url TEXT,
  transcript_url TEXT,

  -- Transcript
  full_transcript TEXT,

  -- Participants
  participants JSONB,

  -- Deduplication fields (from legacy fathom_calls pattern)
  meeting_fingerprint TEXT,
  is_primary BOOLEAN DEFAULT TRUE,
  merged_from BIGINT[],
  fuzzy_match_score NUMERIC,

  -- Full original payload for future-proofing
  raw_payload JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_zoom_raw_calls_recording_id ON zoom_raw_calls (recording_id);
CREATE INDEX idx_zoom_raw_calls_user_id ON zoom_raw_calls (user_id);
CREATE INDEX idx_zoom_raw_calls_zoom_meeting_id ON zoom_raw_calls (zoom_meeting_id);
CREATE UNIQUE INDEX idx_zoom_raw_calls_dedup
  ON zoom_raw_calls (user_id, zoom_meeting_uuid)
  WHERE zoom_meeting_uuid IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE zoom_raw_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own zoom raw calls"
  ON zoom_raw_calls FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own zoom raw calls"
  ON zoom_raw_calls FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own zoom raw calls"
  ON zoom_raw_calls FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own zoom raw calls"
  ON zoom_raw_calls FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage zoom_raw_calls"
  ON zoom_raw_calls
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE zoom_raw_calls IS 'Raw Zoom meeting data with typed columns. FK to recordings for canonical reference.';
COMMENT ON COLUMN zoom_raw_calls.recording_id IS 'FK to canonical recordings table';
COMMENT ON COLUMN zoom_raw_calls.raw_payload IS 'Full original webhook/API payload for future-proofing';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
