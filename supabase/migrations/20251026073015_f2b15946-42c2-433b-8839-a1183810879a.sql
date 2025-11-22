-- Create fathom_calls table
CREATE TABLE IF NOT EXISTS fathom_calls (
  recording_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  recording_start_time TIMESTAMPTZ,
  recording_end_time TIMESTAMPTZ,
  url TEXT,
  share_url TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fathom_transcripts table
CREATE TABLE IF NOT EXISTS fathom_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id BIGINT NOT NULL REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  speaker_name TEXT,
  speaker_email TEXT,
  text TEXT NOT NULL,
  timestamp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON fathom_transcripts(recording_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON fathom_calls(created_at DESC);

-- Create processed_webhooks table for idempotency
CREATE TABLE IF NOT EXISTS processed_webhooks (
  webhook_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE fathom_calls IS 'Stores Fathom meeting recordings metadata';
COMMENT ON TABLE fathom_transcripts IS 'Stores transcript segments for each Fathom meeting';
COMMENT ON TABLE processed_webhooks IS 'Tracks processed webhook IDs to prevent duplicate processing';