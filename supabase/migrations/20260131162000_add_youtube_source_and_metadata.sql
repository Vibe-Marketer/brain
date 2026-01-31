-- Migration: Add YouTube source support to fathom_calls
-- Purpose: Enable importing YouTube videos as call transcripts by:
--   1. Adding 'youtube' to source_platform constraint
--   2. Adding metadata JSONB column for platform-specific data
-- Author: Claude
-- Date: 2026-01-31

-- ============================================================================
-- ADD METADATA COLUMN
-- ============================================================================
-- Add metadata JSONB column to store platform-specific data like YouTube video info
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN public.fathom_calls.metadata IS 'Platform-specific metadata. For YouTube: video_id, channel_id, channel_title, description, thumbnail, duration';

-- ============================================================================
-- UPDATE SOURCE PLATFORM CONSTRAINT
-- ============================================================================
-- Drop existing constraint and recreate with 'youtube' option
ALTER TABLE public.fathom_calls
DROP CONSTRAINT IF EXISTS fathom_calls_source_platform_check;

ALTER TABLE public.fathom_calls
ADD CONSTRAINT fathom_calls_source_platform_check
CHECK (source_platform IN ('fathom', 'google_meet', 'zoom', 'youtube', 'other'));

-- Also update transcript_chunks constraint to include youtube
ALTER TABLE public.transcript_chunks
DROP CONSTRAINT IF EXISTS transcript_chunks_source_platform_check;

ALTER TABLE public.transcript_chunks
ADD CONSTRAINT transcript_chunks_source_platform_check
CHECK (source_platform IN ('fathom', 'google_meet', 'zoom', 'youtube', 'other'));

-- ============================================================================
-- CREATE INDEX FOR YOUTUBE QUERIES
-- ============================================================================
-- Index for querying by youtube video ID in metadata
CREATE INDEX IF NOT EXISTS idx_fathom_calls_youtube_video_id
ON public.fathom_calls ((metadata->>'youtube_video_id'))
WHERE source_platform = 'youtube';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
