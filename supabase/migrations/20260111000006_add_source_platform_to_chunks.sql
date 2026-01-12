-- Add source_platform to transcript_chunks for unified multi-source search
-- This enables filtering search results by integration source (Fathom, Google Meet, Zoom)

-- Add source_platform column with default of 'fathom' for existing data
ALTER TABLE transcript_chunks
ADD COLUMN IF NOT EXISTS source_platform TEXT DEFAULT 'fathom';

-- Create index for efficient filtering by source platform
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_source_platform
ON transcript_chunks(source_platform);

-- Backfill existing chunks from fathom_calls source_platform
-- This ensures historical data has correct source attribution
UPDATE transcript_chunks tc
SET source_platform = fc.source_platform
FROM fathom_calls fc
WHERE tc.recording_id = fc.recording_id
  AND tc.user_id = fc.user_id
  AND fc.source_platform IS NOT NULL
  AND fc.source_platform != 'fathom';

-- Add constraint to validate source_platform values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transcript_chunks_source_platform_check'
    ) THEN
        ALTER TABLE transcript_chunks
        ADD CONSTRAINT transcript_chunks_source_platform_check
        CHECK (source_platform IN ('fathom', 'google_meet', 'zoom', 'other'));
    END IF;
END $$;

COMMENT ON COLUMN transcript_chunks.source_platform IS 'Origin platform of the transcript: fathom, google_meet, zoom, other';
