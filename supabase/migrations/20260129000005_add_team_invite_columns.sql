-- Migration: Add invite_token and invite_expires_at to teams table
-- Purpose: Enable shareable team invite links without creating pending memberships
-- Author: Claude Code
-- Date: 2026-01-29

-- ============================================================================
-- BACKGROUND
-- ============================================================================
-- The generateTeamInvite function was incorrectly creating a pending membership
-- with the inviter's user_id, causing a duplicate key violation since the inviter
-- already has an active membership.
--
-- Solution: Store the team's shareable invite token on the teams table itself.
-- When someone uses the link, a new membership is created for the joining user.

-- ============================================================================
-- ADD COLUMNS TO teams TABLE
-- ============================================================================

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS invite_token VARCHAR(32),
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Index for fast lookup by invite token
CREATE INDEX IF NOT EXISTS idx_teams_invite_token 
ON teams(invite_token) WHERE invite_token IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN teams.invite_token IS 
'Shareable invite token for the team. Anyone with a valid token can join.';

COMMENT ON COLUMN teams.invite_expires_at IS 
'Expiration timestamp for the invite token. Tokens expire after 7 days by default.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
