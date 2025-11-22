-- Create webhook_deliveries table to track all webhook attempts
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  webhook_id TEXT NOT NULL,
  recording_id BIGINT,
  status TEXT NOT NULL, -- 'success', 'failed', 'duplicate'
  error_message TEXT,
  request_headers JSONB,
  request_body JSONB,
  signature_valid BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_webhook_deliveries_user_id ON webhook_deliveries(user_id);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);

-- Enable RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage webhook deliveries"
  ON webhook_deliveries FOR ALL
  USING (true)
  WITH CHECK (true);