-- Add test status tracking columns to user_settings
ALTER TABLE user_settings 
ADD COLUMN oauth_last_tested_at TIMESTAMPTZ,
ADD COLUMN oauth_test_status TEXT,
ADD COLUMN webhook_last_tested_at TIMESTAMPTZ,
ADD COLUMN webhook_test_status TEXT;