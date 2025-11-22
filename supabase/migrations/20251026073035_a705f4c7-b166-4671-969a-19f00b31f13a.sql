-- Enable Row Level Security on all tables
ALTER TABLE fathom_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE fathom_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies for fathom_calls
-- Note: These tables are for demonstration. In production, users sync to their own external Supabase.
-- Allow service role to manage all data (used by edge functions)
CREATE POLICY "Service role can manage fathom_calls"
  ON fathom_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for fathom_transcripts
CREATE POLICY "Service role can manage fathom_transcripts"
  ON fathom_transcripts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for processed_webhooks
CREATE POLICY "Service role can manage processed_webhooks"
  ON processed_webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);