-- Add OAuth token storage to user_settings
ALTER TABLE user_settings
ADD COLUMN oauth_access_token TEXT,
ADD COLUMN oauth_refresh_token TEXT,
ADD COLUMN oauth_token_expires BIGINT;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_oauth_refresh ON user_settings(oauth_refresh_token) WHERE oauth_refresh_token IS NOT NULL;