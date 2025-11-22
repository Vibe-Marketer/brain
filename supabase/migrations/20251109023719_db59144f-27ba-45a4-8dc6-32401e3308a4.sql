-- Add editing columns to fathom_transcripts for non-destructive editing
ALTER TABLE fathom_transcripts 
ADD COLUMN IF NOT EXISTS edited_text TEXT,
ADD COLUMN IF NOT EXISTS edited_speaker_name TEXT,
ADD COLUMN IF NOT EXISTS edited_speaker_email TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edited_by UUID;

-- Create index for filtering deleted segments
CREATE INDEX IF NOT EXISTS idx_transcripts_is_deleted 
ON fathom_transcripts(recording_id, is_deleted);

-- Create index for finding edited segments
CREATE INDEX IF NOT EXISTS idx_transcripts_edited 
ON fathom_transcripts(recording_id) 
WHERE edited_text IS NOT NULL OR edited_speaker_name IS NOT NULL;

-- Add comment to explain the editing strategy
COMMENT ON COLUMN fathom_transcripts.edited_text IS 'Stores user-edited text. NULL means using original text. Never modify original text column.';
COMMENT ON COLUMN fathom_transcripts.is_deleted IS 'Soft delete flag for trim functionality. TRUE hides segment from display.';