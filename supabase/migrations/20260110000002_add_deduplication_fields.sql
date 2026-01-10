-- Add deduplication and Google Meet source fields to fathom_calls table
-- This migration enables multi-source meeting deduplication per SPEC-multi-source-deduplication.md

-- Deduplication core columns
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS meeting_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS source_platform TEXT DEFAULT 'fathom',
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS merged_from BIGINT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS fuzzy_match_score NUMERIC;

-- Google-specific source identifiers for correlation
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT,
ADD COLUMN IF NOT EXISTS transcript_source TEXT DEFAULT 'native';

-- Add comments for documentation
COMMENT ON COLUMN public.fathom_calls.meeting_fingerprint IS 'SHA-256 hash of normalized title + time bucket + participant hash for duplicate detection';
COMMENT ON COLUMN public.fathom_calls.source_platform IS 'Origin platform of the meeting: fathom, google_meet, zoom, etc.';
COMMENT ON COLUMN public.fathom_calls.is_primary IS 'True if this is the primary record for a deduplicated meeting group';
COMMENT ON COLUMN public.fathom_calls.merged_from IS 'Array of recording_ids that were merged into this primary record';
COMMENT ON COLUMN public.fathom_calls.fuzzy_match_score IS 'Confidence score (0-1) of the duplicate match when merged';
COMMENT ON COLUMN public.fathom_calls.google_calendar_event_id IS 'Google Calendar event ID for Google Meet sourced meetings';
COMMENT ON COLUMN public.fathom_calls.google_drive_file_id IS 'Google Drive file ID for the recording file';
COMMENT ON COLUMN public.fathom_calls.transcript_source IS 'Source of transcript: native (from platform), whisper (AI-generated)';

-- Create indexes for fast duplicate lookups
-- Partial index on fingerprint for primary records only - most common query pattern
CREATE INDEX IF NOT EXISTS idx_meeting_fingerprint ON public.fathom_calls(meeting_fingerprint)
  WHERE is_primary = true;

-- Index for filtering by source platform
CREATE INDEX IF NOT EXISTS idx_source_platform ON public.fathom_calls(source_platform);

-- Index for Google Calendar event correlation
CREATE INDEX IF NOT EXISTS idx_google_calendar_event ON public.fathom_calls(google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

-- Index for Google Drive file correlation
CREATE INDEX IF NOT EXISTS idx_google_drive_file ON public.fathom_calls(google_drive_file_id)
  WHERE google_drive_file_id IS NOT NULL;

-- Add constraint to validate source_platform values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fathom_calls_source_platform_check'
    ) THEN
        ALTER TABLE public.fathom_calls
        ADD CONSTRAINT fathom_calls_source_platform_check
        CHECK (source_platform IN ('fathom', 'google_meet', 'zoom', 'other'));
    END IF;
END $$;

-- Add constraint to validate transcript_source values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fathom_calls_transcript_source_check'
    ) THEN
        ALTER TABLE public.fathom_calls
        ADD CONSTRAINT fathom_calls_transcript_source_check
        CHECK (transcript_source IN ('native', 'whisper'));
    END IF;
END $$;
