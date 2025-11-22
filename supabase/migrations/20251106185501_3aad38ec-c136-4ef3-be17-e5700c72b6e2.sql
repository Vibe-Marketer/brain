-- Add OAuth state column for CSRF protection
ALTER TABLE user_settings
ADD COLUMN oauth_state TEXT;