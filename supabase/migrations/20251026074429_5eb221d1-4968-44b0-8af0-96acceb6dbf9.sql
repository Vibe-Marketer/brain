-- Create app_config table for storing configuration
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Service role can manage app_config
CREATE POLICY "Service role can manage app_config"
  ON app_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);