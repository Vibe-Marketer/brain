-- Phase 1 Foundation: Personal Folders & Tags, Workspaces 'is_home'

-- 1. Add is_home to workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS is_home BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure only one is_home per organization (Unique Partial Index)
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_is_home_idx 
ON workspaces (organization_id) 
WHERE is_home = true;

-- 2. Drop folder_id and local_tags from workspace_entries
ALTER TABLE workspace_entries 
DROP COLUMN IF EXISTS folder_id,
DROP COLUMN IF EXISTS local_tags;

-- 3. Create personal_folders and personal_tags
CREATE TABLE IF NOT EXISTS personal_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: user_id and organization_id scope personal folders. A user can create duplicate names across orgs.
CREATE TABLE IF NOT EXISTS personal_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction tables to link to recordings
CREATE TABLE IF NOT EXISTS personal_folder_recordings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES personal_folders(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (folder_id, recording_id)
);

CREATE TABLE IF NOT EXISTS personal_tag_recordings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES personal_tags(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, recording_id)
);

-- Add email organization invites
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('organization_owner', 'organization_admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invite_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a single user can't be invited to the same org if they have a pending invite
CREATE UNIQUE INDEX IF NOT EXISTS org_invitations_email_org_idx 
ON organization_invitations (organization_id, email, status) 
WHERE status = 'pending';

-- 4. Enable RLS
ALTER TABLE personal_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_folder_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_tag_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Only the user who created them can see/edit personal folders and tags
CREATE POLICY "Users fully own their personal folders" 
ON personal_folders 
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users fully own their personal tags" 
ON personal_tags 
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users fully own their folder recording links" 
ON personal_folder_recordings 
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users fully own their tag recording links" 
ON personal_tag_recordings 
FOR ALL USING (user_id = auth.uid());

-- Org Invites RLS
CREATE POLICY "Org Admins/Owners can manage invites" 
ON organization_invitations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships om 
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_invitations.organization_id 
    AND om.role IN ('organization_owner', 'organization_admin')
  )
);

-- Invite lookup for join page is done via SECURITY DEFINER RPC (get_organization_invite_details).
-- No broad SELECT policy needed — that would expose all pending invites to any user.

-- Org Admins and Owners can see all recordings in their org
CREATE POLICY "Org Admins can view all recordings in org"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = recordings.organization_id
        AND om.role IN ('organization_owner', 'organization_admin')
    )
  );

-- Helper to automatically make a HOME workspace for an org
CREATE OR REPLACE FUNCTION ensure_home_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (organization_id, name, workspace_type, is_home)
  VALUES (NEW.id, 'Home Workspace', 'team', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create HOME workspace on new Orgs
DROP TRIGGER IF EXISTS tr_ensure_home_workspace ON organizations;
CREATE TRIGGER tr_ensure_home_workspace
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION ensure_home_workspace();

-- Backfill existing organizations with a HOME workspace if they dont have one
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    IF NOT EXISTS (SELECT 1 FROM workspaces WHERE organization_id = org.id AND is_home = true) THEN
      INSERT INTO workspaces (organization_id, name, workspace_type, is_home)
      VALUES (org.id, 'Home Workspace', 'team', true);
    END IF;
  END LOOP;
END;
$$;
