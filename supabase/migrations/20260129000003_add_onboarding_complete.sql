-- Migration: Add onboarding_complete to team_memberships
-- Tracks whether a team member has completed the onboarding flow
-- Per CONTEXT.md: "User added to team but marked as 'pending setup'"

ALTER TABLE team_memberships 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Add index for quick filtering of pending members
CREATE INDEX IF NOT EXISTS idx_team_memberships_onboarding_incomplete
ON team_memberships(team_id, onboarding_complete)
WHERE onboarding_complete = false AND status = 'active';

-- Comment for documentation
COMMENT ON COLUMN team_memberships.onboarding_complete IS 
'Whether member has completed onboarding. Admins see "Pending setup" badge for incomplete members.';
