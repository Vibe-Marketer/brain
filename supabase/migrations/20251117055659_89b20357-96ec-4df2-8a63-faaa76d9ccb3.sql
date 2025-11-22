-- Create AI processing jobs table for tracking title generation and auto-tagging progress
CREATE TABLE IF NOT EXISTS ai_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('title_generation', 'auto_tagging')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  recording_ids INTEGER[] NOT NULL,
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER NOT NULL,
  processed_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  failed_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  success_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX idx_ai_processing_jobs_user_status ON ai_processing_jobs(user_id, status);
CREATE INDEX idx_ai_processing_jobs_created ON ai_processing_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE ai_processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own AI processing jobs"
  ON ai_processing_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI processing jobs"
  ON ai_processing_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI processing jobs"
  ON ai_processing_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ai_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_processing_jobs_updated_at
  BEFORE UPDATE ON ai_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_processing_jobs_updated_at();