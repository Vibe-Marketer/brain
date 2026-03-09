-- Migration: Add extended fields to youtube_raw_calls
-- Purpose: Store tags, video definition (HD/SD), channel video count, and channel description
--          that were missing from the initial table creation.
-- Date: 2026-03-09

-- ============================================================================
-- ALTER: youtube_raw_calls — add missing columns
-- ============================================================================
ALTER TABLE youtube_raw_calls
  ADD COLUMN IF NOT EXISTS youtube_tags JSONB,
  ADD COLUMN IF NOT EXISTS youtube_definition TEXT,
  ADD COLUMN IF NOT EXISTS youtube_channel_video_count BIGINT,
  ADD COLUMN IF NOT EXISTS youtube_channel_description TEXT;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN youtube_raw_calls.youtube_tags IS 'Array of YouTube video tags from snippet.tags';
COMMENT ON COLUMN youtube_raw_calls.youtube_definition IS 'Video definition: "hd" or "sd" from contentDetails.definition';
COMMENT ON COLUMN youtube_raw_calls.youtube_channel_video_count IS 'Total public videos on channel at time of import';
COMMENT ON COLUMN youtube_raw_calls.youtube_channel_description IS 'Channel description (truncated to 500 chars)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
