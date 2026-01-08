-- Migration: Create single call share tables
-- Purpose: Enable users to share individual calls via unique shareable links
-- Author: Claude Code
-- Date: 2026-01-08

-- ============================================================================
-- TABLE: call_share_links
-- ============================================================================
-- Stores shareable links for individual call recordings
-- Each link has a unique token and can be revoked by the owner
CREATE TABLE call_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token VARCHAR(32) NOT NULL UNIQUE,
  recipient_email TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  -- Composite FK to fathom_calls (recording_id, user_id)
  FOREIGN KEY (call_recording_id, user_id)
    REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: call_share_access_log
-- ============================================================================
-- Logs access to shared call links for audit and analytics
CREATE TABLE call_share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES call_share_links(id) ON DELETE CASCADE,
  accessed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Index for looking up share links by share token (primary lookup pattern)
CREATE INDEX idx_call_share_links_share_token
  ON call_share_links(share_token);

-- Index for looking up share links by call recording
CREATE INDEX idx_call_share_links_call_recording_id
  ON call_share_links(call_recording_id);

-- Index for looking up share links by owner
CREATE INDEX idx_call_share_links_user_id
  ON call_share_links(user_id);

-- Composite index for efficient lookups by recording + user
CREATE INDEX idx_call_share_links_recording_user
  ON call_share_links(call_recording_id, user_id);

-- Index for looking up share links by status
CREATE INDEX idx_call_share_links_status
  ON call_share_links(status);

-- Index for looking up access logs by share link
CREATE INDEX idx_call_share_access_log_share_link_id
  ON call_share_access_log(share_link_id);

-- Index for looking up access logs by user who accessed
CREATE INDEX idx_call_share_access_log_accessed_by_user_id
  ON call_share_access_log(accessed_by_user_id);

-- Index for ordering access logs by time
CREATE INDEX idx_call_share_access_log_accessed_at
  ON call_share_access_log(accessed_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on both tables
ALTER TABLE call_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_share_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: call_share_links
-- ============================================================================

-- Policy: Users can view share links they own (created for their calls)
CREATE POLICY "Users can view their own share links"
  ON call_share_links
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can view share links shared with them (by token lookup via edge function)
-- Note: Token-based access will be handled through edge functions with service role

-- Policy: Users can create share links for their own calls
CREATE POLICY "Users can create share links for their calls"
  ON call_share_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() = created_by_user_id);

-- Policy: Users can update their own share links (e.g., revoke)
CREATE POLICY "Users can update their own share links"
  ON call_share_links
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own share links
CREATE POLICY "Users can delete their own share links"
  ON call_share_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: call_share_access_log
-- ============================================================================

-- Policy: Call owners can view access logs for their share links
CREATE POLICY "Owners can view access logs for their share links"
  ON call_share_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_share_links
      WHERE call_share_links.id = call_share_access_log.share_link_id
        AND call_share_links.user_id = auth.uid()
    )
  );

-- Policy: Access logs are created by edge functions with service role
-- Note: Insert will be handled through edge functions with service role key
-- Users cannot directly insert access logs

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to tables and columns

COMMENT ON TABLE call_share_links IS
  'Shareable links for individual call recordings. Each link has a unique token that recipients use to access the call.';

COMMENT ON COLUMN call_share_links.user_id IS
  'Owner of the call being shared';

COMMENT ON COLUMN call_share_links.created_by_user_id IS
  'User who created the share link (may differ from owner in team scenarios)';

COMMENT ON COLUMN call_share_links.share_token IS
  'Unique opaque token used in shareable URLs. 32 characters, URL-safe.';

COMMENT ON COLUMN call_share_links.recipient_email IS
  'Optional email of intended recipient. Used for display purposes only.';

COMMENT ON COLUMN call_share_links.status IS
  'Link status: active (usable) or revoked (disabled)';

COMMENT ON COLUMN call_share_links.revoked_at IS
  'Timestamp when the link was revoked. NULL if still active.';

COMMENT ON TABLE call_share_access_log IS
  'Audit log of all accesses to shared call links. Used for analytics and security.';

COMMENT ON COLUMN call_share_access_log.share_link_id IS
  'Reference to the share link that was accessed';

COMMENT ON COLUMN call_share_access_log.accessed_by_user_id IS
  'User who accessed the shared call via the link';

COMMENT ON COLUMN call_share_access_log.ip_address IS
  'IP address of the accessor (for security audit purposes)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
