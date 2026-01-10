-- Add Google OAuth fields to user_settings table
-- This migration adds columns required for Google Meet integration OAuth flow

-- Google OAuth credentials and state
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS google_oauth_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_oauth_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_oauth_token_expires BIGINT,
ADD COLUMN IF NOT EXISTS google_oauth_state TEXT,
ADD COLUMN IF NOT EXISTS google_oauth_email TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.user_settings.google_oauth_access_token IS 'Google OAuth 2.0 access token for Calendar/Drive API access';
COMMENT ON COLUMN public.user_settings.google_oauth_refresh_token IS 'Google OAuth 2.0 refresh token for obtaining new access tokens';
COMMENT ON COLUMN public.user_settings.google_oauth_token_expires IS 'Unix timestamp when the Google access token expires';
COMMENT ON COLUMN public.user_settings.google_oauth_state IS 'CSRF state token for OAuth flow validation';
COMMENT ON COLUMN public.user_settings.google_oauth_email IS 'Email address of the connected Google account for display purposes';
