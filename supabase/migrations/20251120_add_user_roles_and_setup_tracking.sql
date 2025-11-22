-- Migration: Add user roles and setup tracking
-- Created: 2025-11-20
-- Purpose: Settings page redesign - role-based access and onboarding wizard tracking

-- Add role column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'FREE' CHECK (role IN ('FREE', 'TEAM', 'ADMIN')),
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_wizard_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add Fathom API credentials to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS fathom_api_secret TEXT,
ADD COLUMN IF NOT EXISTS bulk_import_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- Set andrew@aisimple.co as ADMIN
-- COMMENTED OUT: Data will be migrated separately via export/import tools
-- UPDATE user_profiles
-- SET role = 'ADMIN'
-- WHERE user_id = 'eaa275cd-c72b-4a08-adb5-2a002fb8f6a3';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role
ON user_profiles(role)
WHERE role IN ('TEAM', 'ADMIN');

-- Create RLS policy for admin user queries
CREATE POLICY "Admins can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid() AND up.role = 'ADMIN'
  )
);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.role IS 'User role: FREE (default), TEAM (can manage team members), ADMIN (full system access)';
COMMENT ON COLUMN user_profiles.setup_wizard_completed IS 'Tracks if user completed the Fathom integration wizard';
COMMENT ON COLUMN user_settings.fathom_api_secret IS 'Fathom API secret for bulk import functionality';
