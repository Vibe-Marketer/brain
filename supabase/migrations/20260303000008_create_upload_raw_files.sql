-- Migration: Create upload_raw_files table
-- Purpose: Dedicated raw table for file upload metadata, replacing the pattern of
--          storing upload data only in recordings.source_metadata JSONB.
-- Date: 2026-03-03

-- ============================================================================
-- TABLE: upload_raw_files
-- ============================================================================
CREATE TABLE upload_raw_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File metadata
  original_filename TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  storage_path TEXT,

  -- Transcription details
  whisper_model TEXT DEFAULT 'whisper-1',
  transcription_language TEXT,

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
CREATE INDEX idx_upload_raw_files_recording_id ON upload_raw_files (recording_id);
CREATE INDEX idx_upload_raw_files_user_id ON upload_raw_files (user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE upload_raw_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own upload raw files"
  ON upload_raw_files FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own upload raw files"
  ON upload_raw_files FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own upload raw files"
  ON upload_raw_files FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own upload raw files"
  ON upload_raw_files FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage upload_raw_files"
  ON upload_raw_files
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE upload_raw_files IS 'Raw file upload data with typed columns. FK to recordings for canonical reference.';
COMMENT ON COLUMN upload_raw_files.whisper_model IS 'OpenAI Whisper model used for transcription';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
