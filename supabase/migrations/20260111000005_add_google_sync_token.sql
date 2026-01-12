-- Add Google Calendar sync token and polling timestamp to user_settings
-- This enables efficient incremental sync using Google Calendar's syncToken mechanism
-- which reduces API calls by 90-95% compared to full fetches

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS google_sync_token TEXT,
ADD COLUMN IF NOT EXISTS google_last_poll_at TIMESTAMPTZ;

COMMENT ON COLUMN user_settings.google_sync_token IS 'Google Calendar sync token for incremental sync - becomes invalid after 7 days of inactivity';
COMMENT ON COLUMN user_settings.google_last_poll_at IS 'Last successful poll timestamp for Google Meet recordings';
