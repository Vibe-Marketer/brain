-- Migration: Create coach access tables
-- Purpose: Enable coach/coachee relationships with folder/tag-based sharing and private notes
-- Author: Claude Code
-- Date: 2026-01-08

-- ============================================================================
-- TABLE: coach_relationships
-- ============================================================================
-- Bidirectional coach/coachee relationships with invitation workflow
-- Either party can initiate, relationship requires acceptance to become active
CREATE TABLE coach_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coachee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'revoked')),
  invited_by VARCHAR(10) CHECK (invited_by IN ('coach', 'coachee')),
  invite_token VARCHAR(32),
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Prevent duplicate relationships between same coach/coachee pair
  UNIQUE(coach_user_id, coachee_user_id)
);

-- ============================================================================
-- TABLE: coach_shares
-- ============================================================================
-- Defines what content a coachee shares with their coach
-- Can share by folder, tag, or all calls
CREATE TABLE coach_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES coach_relationships(id) ON DELETE CASCADE,
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('folder', 'tag', 'all')),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES user_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure folder_id is set when share_type is 'folder'
  -- Ensure tag_id is set when share_type is 'tag'
  CONSTRAINT coach_shares_folder_check CHECK (
    (share_type = 'folder' AND folder_id IS NOT NULL AND tag_id IS NULL) OR
    (share_type = 'tag' AND tag_id IS NOT NULL AND folder_id IS NULL) OR
    (share_type = 'all' AND folder_id IS NULL AND tag_id IS NULL)
  ),

  -- Prevent duplicate share rules for same relationship + type + target
  UNIQUE(relationship_id, share_type, folder_id, tag_id)
);

-- ============================================================================
-- TABLE: coach_notes
-- ============================================================================
-- Private notes that coaches can add to their coachees' shared calls
-- Notes are visible only to the coach who created them
CREATE TABLE coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES coach_relationships(id) ON DELETE CASCADE,
  call_recording_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite FK to fathom_calls (recording_id, user_id)
  -- user_id here refers to the coachee (call owner)
  FOREIGN KEY (call_recording_id, user_id)
    REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE,

  -- One note per coach per call (coach is implicit via relationship)
  UNIQUE(relationship_id, call_recording_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Indexes for coach_relationships
-- Index for looking up relationships by coach
CREATE INDEX idx_coach_relationships_coach_user_id
  ON coach_relationships(coach_user_id);

-- Index for looking up relationships by coachee
CREATE INDEX idx_coach_relationships_coachee_user_id
  ON coach_relationships(coachee_user_id);

-- Index for looking up relationships by status
CREATE INDEX idx_coach_relationships_status
  ON coach_relationships(status);

-- Index for invite token lookup (for accepting invitations)
CREATE INDEX idx_coach_relationships_invite_token
  ON coach_relationships(invite_token) WHERE invite_token IS NOT NULL;

-- Composite index for efficient coach lookup with status filter
CREATE INDEX idx_coach_relationships_coach_status
  ON coach_relationships(coach_user_id, status);

-- Composite index for efficient coachee lookup with status filter
CREATE INDEX idx_coach_relationships_coachee_status
  ON coach_relationships(coachee_user_id, status);

-- Indexes for coach_shares
-- Index for looking up shares by relationship
CREATE INDEX idx_coach_shares_relationship_id
  ON coach_shares(relationship_id);

-- Index for looking up shares by folder
CREATE INDEX idx_coach_shares_folder_id
  ON coach_shares(folder_id) WHERE folder_id IS NOT NULL;

-- Index for looking up shares by tag
CREATE INDEX idx_coach_shares_tag_id
  ON coach_shares(tag_id) WHERE tag_id IS NOT NULL;

-- Index for looking up shares by type
CREATE INDEX idx_coach_shares_share_type
  ON coach_shares(share_type);

-- Indexes for coach_notes
-- Index for looking up notes by relationship
CREATE INDEX idx_coach_notes_relationship_id
  ON coach_notes(relationship_id);

-- Index for looking up notes by call
CREATE INDEX idx_coach_notes_call_recording_id
  ON coach_notes(call_recording_id);

-- Composite index for efficient call + user lookup
CREATE INDEX idx_coach_notes_recording_user
  ON coach_notes(call_recording_id, user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update the updated_at timestamp for coach_notes

-- Create trigger function for updating updated_at on coach_notes
CREATE OR REPLACE FUNCTION update_coach_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to coach_notes table
CREATE TRIGGER set_coach_notes_updated_at
  BEFORE UPDATE ON coach_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_coach_notes_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE coach_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: coach_relationships
-- ============================================================================

-- Policy: Users can view relationships where they are coach or coachee
CREATE POLICY "Users can view their coach relationships"
  ON coach_relationships
  FOR SELECT
  USING (auth.uid() = coach_user_id OR auth.uid() = coachee_user_id);

-- Policy: Users can create relationships (either as coach or coachee)
CREATE POLICY "Users can create coach relationships"
  ON coach_relationships
  FOR INSERT
  WITH CHECK (
    (auth.uid() = coach_user_id AND invited_by = 'coach') OR
    (auth.uid() = coachee_user_id AND invited_by = 'coachee')
  );

-- Policy: Users can update relationships they are part of
-- Both parties can update (e.g., accept invitation, pause, end)
CREATE POLICY "Users can update their coach relationships"
  ON coach_relationships
  FOR UPDATE
  USING (auth.uid() = coach_user_id OR auth.uid() = coachee_user_id)
  WITH CHECK (auth.uid() = coach_user_id OR auth.uid() = coachee_user_id);

-- Policy: Either party can delete/end the relationship
CREATE POLICY "Users can delete their coach relationships"
  ON coach_relationships
  FOR DELETE
  USING (auth.uid() = coach_user_id OR auth.uid() = coachee_user_id);

-- ============================================================================
-- RLS POLICIES: coach_shares
-- ============================================================================

-- Policy: Both coach and coachee can view share rules for their relationship
CREATE POLICY "Users can view shares for their relationships"
  ON coach_shares
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_shares.relationship_id
        AND (coach_relationships.coach_user_id = auth.uid() OR coach_relationships.coachee_user_id = auth.uid())
    )
  );

-- Policy: Only coachee can create share rules (they decide what to share)
CREATE POLICY "Coachees can create share rules"
  ON coach_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_shares.relationship_id
        AND coach_relationships.coachee_user_id = auth.uid()
    )
  );

-- Policy: Only coachee can update share rules
CREATE POLICY "Coachees can update share rules"
  ON coach_shares
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_shares.relationship_id
        AND coach_relationships.coachee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_shares.relationship_id
        AND coach_relationships.coachee_user_id = auth.uid()
    )
  );

-- Policy: Only coachee can delete share rules
CREATE POLICY "Coachees can delete share rules"
  ON coach_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_shares.relationship_id
        AND coach_relationships.coachee_user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: coach_notes
-- ============================================================================

-- Policy: Coaches can view their own notes only
-- The note belongs to the coach via the relationship
CREATE POLICY "Coaches can view their own notes"
  ON coach_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_notes.relationship_id
        AND coach_relationships.coach_user_id = auth.uid()
    )
  );

-- Policy: Coaches can create notes for calls in their relationships
CREATE POLICY "Coaches can create notes"
  ON coach_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_notes.relationship_id
        AND coach_relationships.coach_user_id = auth.uid()
        AND coach_relationships.status = 'active'
    )
  );

-- Policy: Coaches can update their own notes
CREATE POLICY "Coaches can update their own notes"
  ON coach_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_notes.relationship_id
        AND coach_relationships.coach_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_notes.relationship_id
        AND coach_relationships.coach_user_id = auth.uid()
    )
  );

-- Policy: Coaches can delete their own notes
CREATE POLICY "Coaches can delete their own notes"
  ON coach_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM coach_relationships
      WHERE coach_relationships.id = coach_notes.relationship_id
        AND coach_relationships.coach_user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to tables and columns

COMMENT ON TABLE coach_relationships IS
  'Bidirectional coach/coachee relationships. Either party can initiate via invitation.';

COMMENT ON COLUMN coach_relationships.coach_user_id IS
  'User ID of the coach in the relationship';

COMMENT ON COLUMN coach_relationships.coachee_user_id IS
  'User ID of the coachee (person being coached) in the relationship';

COMMENT ON COLUMN coach_relationships.status IS
  'Relationship status: pending (awaiting acceptance), active, paused, or revoked (ended)';

COMMENT ON COLUMN coach_relationships.invited_by IS
  'Who initiated the relationship: coach or coachee';

COMMENT ON COLUMN coach_relationships.invite_token IS
  'Opaque token for accepting invitation via link. 32 characters, URL-safe.';

COMMENT ON COLUMN coach_relationships.invite_expires_at IS
  'When the invitation expires. Typically 30 days from creation.';

COMMENT ON COLUMN coach_relationships.accepted_at IS
  'Timestamp when the invitation was accepted and relationship became active';

COMMENT ON COLUMN coach_relationships.ended_at IS
  'Timestamp when the relationship was ended (status changed to revoked)';

COMMENT ON TABLE coach_shares IS
  'Defines what content a coachee shares with their coach. Supports folder, tag, or all-calls sharing.';

COMMENT ON COLUMN coach_shares.relationship_id IS
  'Reference to the coach relationship this share rule belongs to';

COMMENT ON COLUMN coach_shares.share_type IS
  'Type of share: folder (specific folder), tag (specific tag), or all (all calls)';

COMMENT ON COLUMN coach_shares.folder_id IS
  'Folder to share (when share_type is folder)';

COMMENT ON COLUMN coach_shares.tag_id IS
  'Tag to share (when share_type is tag)';

COMMENT ON TABLE coach_notes IS
  'Private notes coaches can add to their coachees shared calls. Only visible to the coach who created them.';

COMMENT ON COLUMN coach_notes.relationship_id IS
  'Reference to the coach relationship. Coach is implicit from this reference.';

COMMENT ON COLUMN coach_notes.call_recording_id IS
  'Call recording this note is attached to';

COMMENT ON COLUMN coach_notes.user_id IS
  'User ID of the call owner (coachee). Part of composite FK to fathom_calls.';

COMMENT ON COLUMN coach_notes.note IS
  'The private note content. Only visible to the coach.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
