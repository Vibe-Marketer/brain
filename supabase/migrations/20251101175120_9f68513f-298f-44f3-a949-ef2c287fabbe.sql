-- Add calendar_invitees column to fathom_calls table
ALTER TABLE fathom_calls 
ADD COLUMN IF NOT EXISTS calendar_invitees JSONB;

-- Create index for better query performance on invitees
CREATE INDEX IF NOT EXISTS idx_fathom_calls_calendar_invitees 
ON fathom_calls USING GIN (calendar_invitees);

-- Add timezone preference to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';