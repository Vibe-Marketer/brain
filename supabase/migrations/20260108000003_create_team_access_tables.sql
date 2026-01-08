-- Migration: Create team access tables
-- Purpose: Enable organizational team hierarchies with manager visibility and peer collaboration
-- Author: Claude Code
-- Date: 2026-01-08

-- ============================================================================
-- TABLE: teams
-- ============================================================================
-- Organizations that group users together with shared access controls
-- Each team has an owner (admin) and optional settings for visibility
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_sees_all BOOLEAN DEFAULT FALSE,
  domain_auto_join TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: team_memberships
-- ============================================================================
-- Team member records with role assignments and reporting hierarchy
-- Supports manager/member relationships via self-referencing foreign key
CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  manager_membership_id UUID REFERENCES team_memberships(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  invite_token VARCHAR(32),
  invite_expires_at TIMESTAMPTZ,
  invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,

  -- Each user can only be in a team once
  UNIQUE(team_id, user_id),

  -- Prevent self-referencing manager (user can't be their own manager)
  CONSTRAINT team_memberships_no_self_manager CHECK (id != manager_membership_id)
);

-- ============================================================================
-- TABLE: team_shares
-- ============================================================================
-- Peer-to-peer sharing rules within a team
-- Members can share folders/tags with specific teammates
CREATE TABLE team_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('folder', 'tag')),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES user_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure folder_id is set when share_type is 'folder'
  -- Ensure tag_id is set when share_type is 'tag'
  CONSTRAINT team_shares_type_check CHECK (
    (share_type = 'folder' AND folder_id IS NOT NULL AND tag_id IS NULL) OR
    (share_type = 'tag' AND tag_id IS NOT NULL AND folder_id IS NULL)
  ),

  -- Cannot share with yourself
  CONSTRAINT team_shares_no_self_share CHECK (owner_user_id != recipient_user_id),

  -- Prevent duplicate share rules for same owner + recipient + type + target
  UNIQUE(team_id, owner_user_id, recipient_user_id, share_type, folder_id, tag_id)
);

-- ============================================================================
-- TABLE: manager_notes
-- ============================================================================
-- Private notes that managers can add to their direct reports' calls
-- Notes are visible only to the manager who created them
CREATE TABLE manager_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_recording_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite FK to fathom_calls (recording_id, user_id)
  -- user_id here refers to the direct report (call owner)
  FOREIGN KEY (call_recording_id, user_id)
    REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE,

  -- One note per manager per call
  UNIQUE(manager_user_id, call_recording_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Indexes for teams
-- Index for looking up teams by owner
CREATE INDEX idx_teams_owner_user_id
  ON teams(owner_user_id);

-- Index for domain auto-join lookup
CREATE INDEX idx_teams_domain_auto_join
  ON teams(domain_auto_join) WHERE domain_auto_join IS NOT NULL;

-- Indexes for team_memberships
-- Index for looking up memberships by team
CREATE INDEX idx_team_memberships_team_id
  ON team_memberships(team_id);

-- Index for looking up memberships by user
CREATE INDEX idx_team_memberships_user_id
  ON team_memberships(user_id);

-- Index for looking up memberships by manager
CREATE INDEX idx_team_memberships_manager_membership_id
  ON team_memberships(manager_membership_id) WHERE manager_membership_id IS NOT NULL;

-- Index for looking up memberships by status
CREATE INDEX idx_team_memberships_status
  ON team_memberships(status);

-- Index for invite token lookup (for accepting invitations)
CREATE INDEX idx_team_memberships_invite_token
  ON team_memberships(invite_token) WHERE invite_token IS NOT NULL;

-- Composite index for efficient team + status lookups
CREATE INDEX idx_team_memberships_team_status
  ON team_memberships(team_id, status);

-- Composite index for efficient user + status lookups
CREATE INDEX idx_team_memberships_user_status
  ON team_memberships(user_id, status);

-- Composite index for efficient team + role lookups
CREATE INDEX idx_team_memberships_team_role
  ON team_memberships(team_id, role);

-- Indexes for team_shares
-- Index for looking up shares by team
CREATE INDEX idx_team_shares_team_id
  ON team_shares(team_id);

-- Index for looking up shares by owner
CREATE INDEX idx_team_shares_owner_user_id
  ON team_shares(owner_user_id);

-- Index for looking up shares by recipient
CREATE INDEX idx_team_shares_recipient_user_id
  ON team_shares(recipient_user_id);

-- Index for looking up shares by folder
CREATE INDEX idx_team_shares_folder_id
  ON team_shares(folder_id) WHERE folder_id IS NOT NULL;

-- Index for looking up shares by tag
CREATE INDEX idx_team_shares_tag_id
  ON team_shares(tag_id) WHERE tag_id IS NOT NULL;

-- Composite index for efficient recipient + share_type lookups
CREATE INDEX idx_team_shares_recipient_type
  ON team_shares(recipient_user_id, share_type);

-- Indexes for manager_notes
-- Index for looking up notes by manager
CREATE INDEX idx_manager_notes_manager_user_id
  ON manager_notes(manager_user_id);

-- Index for looking up notes by call
CREATE INDEX idx_manager_notes_call_recording_id
  ON manager_notes(call_recording_id);

-- Index for looking up notes by call owner (direct report)
CREATE INDEX idx_manager_notes_user_id
  ON manager_notes(user_id);

-- Composite index for efficient call + user lookup
CREATE INDEX idx_manager_notes_recording_user
  ON manager_notes(call_recording_id, user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update the updated_at timestamp

-- Create trigger function for updating updated_at on teams
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to teams table
CREATE TRIGGER set_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- Create trigger function for updating updated_at on manager_notes
CREATE OR REPLACE FUNCTION update_manager_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to manager_notes table
CREATE TRIGGER set_manager_notes_updated_at
  BEFORE UPDATE ON manager_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_notes_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: teams
-- ============================================================================

-- Policy: Users can view teams they are members of
CREATE POLICY "Users can view teams they belong to"
  ON teams
  FOR SELECT
  USING (
    auth.uid() = owner_user_id OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = teams.id
        AND team_memberships.user_id = auth.uid()
        AND team_memberships.status = 'active'
    )
  );

-- Policy: Users can create teams (they become the owner)
CREATE POLICY "Users can create teams"
  ON teams
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Only team owner (admin) can update team settings
CREATE POLICY "Team owners can update their teams"
  ON teams
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Only team owner can delete the team
CREATE POLICY "Team owners can delete their teams"
  ON teams
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- ============================================================================
-- RLS POLICIES: team_memberships
-- ============================================================================

-- Policy: Users can view memberships in teams they belong to
CREATE POLICY "Users can view memberships in their teams"
  ON team_memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_memberships AS my_membership
      WHERE my_membership.team_id = team_memberships.team_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.status = 'active'
    )
    OR
    -- Users can see their own pending memberships
    (team_memberships.user_id = auth.uid())
    OR
    -- Team owners can see all memberships
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- Policy: Team admins can create memberships (invite members)
CREATE POLICY "Team admins can create memberships"
  ON team_memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_memberships AS admin_membership
      WHERE admin_membership.team_id = team_memberships.team_id
        AND admin_membership.user_id = auth.uid()
        AND admin_membership.role = 'admin'
        AND admin_membership.status = 'active'
    )
    OR
    -- Team owners can always invite
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- Policy: Team admins and the member themselves can update memberships
CREATE POLICY "Team admins and members can update memberships"
  ON team_memberships
  FOR UPDATE
  USING (
    -- User updating their own membership (e.g., accepting invite)
    team_memberships.user_id = auth.uid()
    OR
    -- Admin updating any membership
    EXISTS (
      SELECT 1 FROM team_memberships AS admin_membership
      WHERE admin_membership.team_id = team_memberships.team_id
        AND admin_membership.user_id = auth.uid()
        AND admin_membership.role = 'admin'
        AND admin_membership.status = 'active'
    )
    OR
    -- Team owner can update any membership
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- User updating their own membership
    team_memberships.user_id = auth.uid()
    OR
    -- Admin updating any membership
    EXISTS (
      SELECT 1 FROM team_memberships AS admin_membership
      WHERE admin_membership.team_id = team_memberships.team_id
        AND admin_membership.user_id = auth.uid()
        AND admin_membership.role = 'admin'
        AND admin_membership.status = 'active'
    )
    OR
    -- Team owner can update any membership
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- Policy: Team admins can delete memberships
CREATE POLICY "Team admins can delete memberships"
  ON team_memberships
  FOR DELETE
  USING (
    -- User deleting their own membership (leaving team)
    team_memberships.user_id = auth.uid()
    OR
    -- Admin deleting any membership
    EXISTS (
      SELECT 1 FROM team_memberships AS admin_membership
      WHERE admin_membership.team_id = team_memberships.team_id
        AND admin_membership.user_id = auth.uid()
        AND admin_membership.role = 'admin'
        AND admin_membership.status = 'active'
    )
    OR
    -- Team owner can delete any membership
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: team_shares
-- ============================================================================

-- Policy: Users can view shares where they are owner or recipient
CREATE POLICY "Users can view their team shares"
  ON team_shares
  FOR SELECT
  USING (
    auth.uid() = owner_user_id OR auth.uid() = recipient_user_id
  );

-- Policy: Users can create shares for their own content
CREATE POLICY "Users can create team shares for their content"
  ON team_shares
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_user_id
    AND
    -- Both users must be active members of the same team
    EXISTS (
      SELECT 1 FROM team_memberships AS owner_membership
      WHERE owner_membership.team_id = team_shares.team_id
        AND owner_membership.user_id = auth.uid()
        AND owner_membership.status = 'active'
    )
    AND
    EXISTS (
      SELECT 1 FROM team_memberships AS recipient_membership
      WHERE recipient_membership.team_id = team_shares.team_id
        AND recipient_membership.user_id = team_shares.recipient_user_id
        AND recipient_membership.status = 'active'
    )
  );

-- Policy: Only owner can update their shares
CREATE POLICY "Users can update their own team shares"
  ON team_shares
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Owner can delete their shares
CREATE POLICY "Users can delete their own team shares"
  ON team_shares
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- ============================================================================
-- RLS POLICIES: manager_notes
-- ============================================================================

-- Policy: Managers can view their own notes only
CREATE POLICY "Managers can view their own notes"
  ON manager_notes
  FOR SELECT
  USING (auth.uid() = manager_user_id);

-- Policy: Managers can create notes for their direct reports' calls
-- Note: The actual manager-report verification happens at application level
-- because the hierarchy check is complex (recursive)
CREATE POLICY "Managers can create notes"
  ON manager_notes
  FOR INSERT
  WITH CHECK (auth.uid() = manager_user_id);

-- Policy: Managers can update their own notes
CREATE POLICY "Managers can update their own notes"
  ON manager_notes
  FOR UPDATE
  USING (auth.uid() = manager_user_id)
  WITH CHECK (auth.uid() = manager_user_id);

-- Policy: Managers can delete their own notes
CREATE POLICY "Managers can delete their own notes"
  ON manager_notes
  FOR DELETE
  USING (auth.uid() = manager_user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user is a manager of another user (direct or indirect)
-- Used for validating manager access to direct report calls
CREATE OR REPLACE FUNCTION is_manager_of(
  p_manager_user_id UUID,
  p_report_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_membership_id UUID;
  v_manager_user_id UUID;
  v_depth INTEGER := 0;
  v_max_depth INTEGER := 10; -- Prevent infinite loops
BEGIN
  -- Get the membership record for the potential report
  SELECT tm.manager_membership_id INTO v_current_membership_id
  FROM team_memberships tm
  WHERE tm.user_id = p_report_user_id
    AND tm.status = 'active';

  IF v_current_membership_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Walk up the hierarchy looking for the manager
  WHILE v_current_membership_id IS NOT NULL AND v_depth < v_max_depth LOOP
    SELECT tm.user_id, tm.manager_membership_id
    INTO v_manager_user_id, v_current_membership_id
    FROM team_memberships tm
    WHERE tm.id = v_current_membership_id
      AND tm.status = 'active';

    IF v_manager_user_id = p_manager_user_id THEN
      RETURN TRUE;
    END IF;

    v_depth := v_depth + 1;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for circular hierarchy when setting a manager
-- Returns TRUE if setting the manager would create a cycle
CREATE OR REPLACE FUNCTION would_create_circular_hierarchy(
  p_membership_id UUID,
  p_new_manager_membership_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_id UUID;
  v_depth INTEGER := 0;
  v_max_depth INTEGER := 10;
BEGIN
  IF p_new_manager_membership_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if we're trying to set ourselves as our own manager
  IF p_membership_id = p_new_manager_membership_id THEN
    RETURN TRUE;
  END IF;

  -- Walk up from the proposed manager to see if we ever reach ourselves
  v_current_id := p_new_manager_membership_id;

  WHILE v_current_id IS NOT NULL AND v_depth < v_max_depth LOOP
    SELECT tm.manager_membership_id INTO v_current_id
    FROM team_memberships tm
    WHERE tm.id = v_current_id;

    IF v_current_id = p_membership_id THEN
      RETURN TRUE;
    END IF;

    v_depth := v_depth + 1;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to tables and columns

COMMENT ON TABLE teams IS
  'Organizations that group users together with shared access controls and hierarchy.';

COMMENT ON COLUMN teams.owner_user_id IS
  'User who created and owns the team. Has full admin privileges.';

COMMENT ON COLUMN teams.admin_sees_all IS
  'If true, admins can see all team members calls regardless of reporting structure.';

COMMENT ON COLUMN teams.domain_auto_join IS
  'Email domain for auto-join feature. Users with matching domain can join without invite.';

COMMENT ON TABLE team_memberships IS
  'Team member records with role assignments and manager/report hierarchy.';

COMMENT ON COLUMN team_memberships.team_id IS
  'Reference to the team this membership belongs to';

COMMENT ON COLUMN team_memberships.user_id IS
  'User who is a member of the team';

COMMENT ON COLUMN team_memberships.role IS
  'Member role: admin (full control), manager (can manage reports), member (basic access)';

COMMENT ON COLUMN team_memberships.manager_membership_id IS
  'Self-reference to the manager membership record. Creates reporting hierarchy.';

COMMENT ON COLUMN team_memberships.status IS
  'Membership status: pending (invited), active (joined), removed (no longer member)';

COMMENT ON COLUMN team_memberships.invite_token IS
  'Opaque token for accepting invitation via link. 32 characters, URL-safe.';

COMMENT ON COLUMN team_memberships.invite_expires_at IS
  'When the invitation expires. Typically 30 days from creation.';

COMMENT ON COLUMN team_memberships.invited_by_user_id IS
  'User who sent the invitation';

COMMENT ON COLUMN team_memberships.joined_at IS
  'Timestamp when the member accepted the invitation and joined';

COMMENT ON TABLE team_shares IS
  'Peer-to-peer sharing rules within a team. Members can share folders/tags with teammates.';

COMMENT ON COLUMN team_shares.team_id IS
  'Reference to the team this share belongs to';

COMMENT ON COLUMN team_shares.owner_user_id IS
  'User who owns the content being shared';

COMMENT ON COLUMN team_shares.recipient_user_id IS
  'User who receives access to the shared content';

COMMENT ON COLUMN team_shares.share_type IS
  'Type of share: folder (specific folder) or tag (specific tag)';

COMMENT ON COLUMN team_shares.folder_id IS
  'Folder to share (when share_type is folder)';

COMMENT ON COLUMN team_shares.tag_id IS
  'Tag to share (when share_type is tag)';

COMMENT ON TABLE manager_notes IS
  'Private notes managers can add to their direct reports calls. Only visible to the manager.';

COMMENT ON COLUMN manager_notes.manager_user_id IS
  'User ID of the manager who created the note';

COMMENT ON COLUMN manager_notes.call_recording_id IS
  'Call recording this note is attached to';

COMMENT ON COLUMN manager_notes.user_id IS
  'User ID of the call owner (direct report). Part of composite FK to fathom_calls.';

COMMENT ON COLUMN manager_notes.note IS
  'The private note content. Only visible to the manager who created it.';

COMMENT ON FUNCTION is_manager_of IS
  'Checks if a user is a manager (direct or indirect) of another user in the team hierarchy.';

COMMENT ON FUNCTION would_create_circular_hierarchy IS
  'Checks if setting a manager would create a circular reference in the reporting hierarchy.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
