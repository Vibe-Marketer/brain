-- Migration: Add invite_token and invite_expires_at to vaults table
-- Purpose: Enable shareable vault invite links (same pattern as team invite links)
-- Author: Claude Code
-- Date: 2026-02-10

-- ============================================================================
-- BACKGROUND
-- ============================================================================
-- Vault invite links follow the exact same pattern as team invite links.
-- NO vault_invitations table — token lives on the vaults table directly.
-- When someone uses the link, a new vault_membership is created for the joining user
-- with role='member' (default join role is always 'member').

-- ============================================================================
-- ADD COLUMNS TO vaults TABLE
-- ============================================================================

ALTER TABLE vaults
ADD COLUMN IF NOT EXISTS invite_token VARCHAR(32),
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Index for fast lookup by invite token
CREATE INDEX IF NOT EXISTS idx_vaults_invite_token
ON vaults(invite_token) WHERE invite_token IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN vaults.invite_token IS
'Shareable invite token for the vault. Anyone with a valid token can join as member.';

COMMENT ON COLUMN vaults.invite_expires_at IS
'Expiration timestamp for the invite token. Tokens expire after 7 days by default.';

-- ============================================================================
-- RLS POLICY: Allow users to join vault by creating their own membership
-- ============================================================================
-- The existing policy "Users can create own vault membership" already allows
-- user_id = auth.uid() inserts, which covers the join-by-invite flow.
-- No additional policy needed.

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
