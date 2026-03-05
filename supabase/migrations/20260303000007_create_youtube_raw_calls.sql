-- Migration: Create youtube_raw_calls table
-- Purpose: Dedicated raw table for YouTube video metadata, replacing the pattern of
--          storing YouTube data only in recordings.source_metadata JSONB.
-- Date: 2026-03-03

-- ============================================================================
-- TABLE: youtube_raw_calls
-- ============================================================================
CREATE TABLE youtube_raw_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- YouTube-specific identifiers
  youtube_video_id TEXT NOT NULL,
  youtube_channel_id TEXT,
  youtube_channel_title TEXT,

  -- Video metadata
  youtube_description TEXT,
  youtube_thumbnail TEXT,
  youtube_duration TEXT,          -- ISO 8601 format (e.g., PT1H2M3S)
  youtube_category_id TEXT,
  youtube_published_at TIMESTAMPTZ,

  -- Stats (point-in-time snapshot at import)
  youtube_view_count BIGINT,
  youtube_like_count BIGINT,
  youtube_comment_count BIGINT,
  youtube_subscriber_count BIGINT,

  -- Import tracking
  import_source TEXT,              -- 'youtube-import', 'manual', etc.

  -- Transcript
  full_transcript TEXT,

  -- Full original payload for future-proofing
  raw_payload JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_youtube_raw_calls_recording_id ON youtube_raw_calls (recording_id);
CREATE INDEX idx_youtube_raw_calls_user_id ON youtube_raw_calls (user_id);
CREATE INDEX idx_youtube_raw_calls_video_id ON youtube_raw_calls (youtube_video_id);
CREATE UNIQUE INDEX idx_youtube_raw_calls_dedup
  ON youtube_raw_calls (user_id, youtube_video_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE youtube_raw_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own youtube raw calls"
  ON youtube_raw_calls FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own youtube raw calls"
  ON youtube_raw_calls FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own youtube raw calls"
  ON youtube_raw_calls FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own youtube raw calls"
  ON youtube_raw_calls FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage youtube_raw_calls"
  ON youtube_raw_calls
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE youtube_raw_calls IS 'Raw YouTube video data with typed columns. FK to recordings for canonical reference.';
COMMENT ON COLUMN youtube_raw_calls.youtube_duration IS 'ISO 8601 duration format (e.g., PT1H2M3S)';
COMMENT ON COLUMN youtube_raw_calls.raw_payload IS 'Full original API response for future-proofing';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
