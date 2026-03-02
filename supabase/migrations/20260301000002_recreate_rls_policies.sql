BEGIN;

CREATE OR REPLACE FUNCTION public.get_workspace_organization_id(p_workspace_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM workspaces WHERE id = p_workspace_id
$function$;


-- =============================================================================
-- RLS POLICIES FOR ORGANIZATIONS (formerly Banks)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view banks they belong to" ON organizations;
DROP POLICY IF EXISTS "Bank owners/admins can update their banks" ON organizations;
DROP POLICY IF EXISTS "Any user can create a bank" ON organizations;
DROP POLICY IF EXISTS "Bank owners can delete their banks" ON organizations;

-- Users can view banks they belong to
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (is_organization_member(id, auth.uid()));

-- Bank owners/admins can update their banks
CREATE POLICY "Organization owners/admins can update their organizations"
  ON organizations FOR UPDATE
  USING (is_organization_admin_or_owner(id, auth.uid()));

-- Any user can create a bank
CREATE POLICY "Any user can create an organization"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- Bank owners can delete their banks
CREATE POLICY "Organization owners can delete their organizations"
  ON organizations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.organization_id = organizations.id
        AND organization_memberships.user_id = auth.uid()
        AND organization_memberships.role = 'organization_owner'
    )
  );


-- =============================================================================
-- RLS POLICIES FOR ORGANIZATION_MEMBERSHIPS (formerly BankMemberships)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view memberships in their banks" ON organization_memberships;
DROP POLICY IF EXISTS "Bank admins/owners can manage memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Bank admins/owners can update memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Bank admins/owners can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Users can create their own initial membership" ON organization_memberships;

-- Users can view memberships in their banks
CREATE POLICY "Users can view memberships in their organizations"
  ON organization_memberships FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

-- Bank admins/owners can manage memberships
CREATE POLICY "Organization admins/owners can manage memberships"
  ON organization_memberships FOR INSERT
  WITH CHECK (is_organization_admin_or_owner(organization_id, auth.uid()));

-- Bank admins/owners can update memberships
CREATE POLICY "Organization admins/owners can update memberships"
  ON organization_memberships FOR UPDATE
  USING (is_organization_admin_or_owner(organization_id, auth.uid()));

-- Bank admins/owners can remove members
CREATE POLICY "Organization admins/owners can remove members"
  ON organization_memberships FOR DELETE
  USING (is_organization_admin_or_owner(organization_id, auth.uid()));

-- Allow users to create their own membership (for initial bank creation)
CREATE POLICY "Users can create their own initial organization membership"
  ON organization_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- =============================================================================
-- RLS POLICIES FOR WORKSPACES (formerly Vaults)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view vaults they belong to" ON workspaces;
DROP POLICY IF EXISTS "Bank admins can view all bank vaults" ON workspaces;
DROP POLICY IF EXISTS "Vault owners/admins can update vaults" ON workspaces;
DROP POLICY IF EXISTS "Bank members can create vaults" ON workspaces;
DROP POLICY IF EXISTS "Vault owners can delete vaults" ON workspaces;

-- Users can see vaults they're a member of
CREATE POLICY "Users can view workspaces they belong to"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id, auth.uid()));

-- Bank admins/owners can also see all vaults in their banks
CREATE POLICY "Organization admins can view all organization workspaces"
  ON workspaces FOR SELECT
  USING (is_organization_admin_or_owner(organization_id, auth.uid()));

-- Vault owners/admins can update vault settings
CREATE POLICY "Workspace owners/admins can update workspaces"
  ON workspaces FOR UPDATE
  USING (is_workspace_admin_or_owner(id, auth.uid()));

-- Bank members can create vaults in banks they belong to
CREATE POLICY "Organization members can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (is_organization_member(organization_id, auth.uid()));

-- Vault owners can delete vaults
CREATE POLICY "Workspace owners can delete workspaces"
  ON workspaces FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = workspaces.id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role = 'workspace_owner'
    )
  );

-- =============================================================================
-- RLS POLICIES FOR WORKSPACE_MEMBERSHIPS (formerly VaultMemberships)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view vault memberships" ON workspace_memberships;
DROP POLICY IF EXISTS "Bank admins can view all vault memberships" ON workspace_memberships;
DROP POLICY IF EXISTS "Vault admins can insert memberships" ON workspace_memberships;
DROP POLICY IF EXISTS "Users can create own vault membership" ON workspace_memberships;
DROP POLICY IF EXISTS "Vault admins can update memberships" ON workspace_memberships;
DROP POLICY IF EXISTS "Vault admins can remove members" ON workspace_memberships;

-- Users can view memberships in their vaults
CREATE POLICY "Users can view workspace memberships"
  ON workspace_memberships FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Bank admins can see all vault memberships in their banks
CREATE POLICY "Organization admins can view all workspace memberships"
  ON workspace_memberships FOR SELECT
  USING (
    is_organization_admin_or_owner(get_workspace_organization_id(workspace_id), auth.uid())
  );

-- Vault admins/owners can manage memberships
CREATE POLICY "Workspace admins can insert memberships"
  ON workspace_memberships FOR INSERT
  WITH CHECK (is_workspace_admin_or_owner(workspace_id, auth.uid()));

-- Users can create their own membership when creating vault
CREATE POLICY "Users can create own workspace membership"
  ON workspace_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Workspace admins can update memberships"
  ON workspace_memberships FOR UPDATE
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can remove members"
  ON workspace_memberships FOR DELETE
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));


-- =============================================================================
-- RLS POLICIES FOR WORKSPACE_ENTRIES (formerly VaultEntries)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view vault entries in their vaults" ON workspace_entries;
DROP POLICY IF EXISTS "Bank admins can view all vault entries" ON workspace_entries;
DROP POLICY IF EXISTS "Vault members can create entries" ON workspace_entries;
DROP POLICY IF EXISTS "Vault admins can update entries" ON workspace_entries;
DROP POLICY IF EXISTS "Members can update own entries" ON workspace_entries;
DROP POLICY IF EXISTS "Vault admins can delete entries" ON workspace_entries;
DROP POLICY IF EXISTS "Members can delete own entries" ON workspace_entries;

CREATE POLICY "Users can view workspace entries in their workspaces"
  ON workspace_entries FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Organization admins can view all workspace entries"
  ON workspace_entries FOR SELECT
  USING (
    is_organization_admin_or_owner(get_workspace_organization_id(workspace_id), auth.uid())
  );

CREATE POLICY "Workspace members can create entries"
  ON workspace_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('workspace_owner', 'workspace_admin', 'manager', 'member')
    )
  );

CREATE POLICY "Workspace admins can update entries"
  ON workspace_entries FOR UPDATE
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "Members can update own entries"
  ON workspace_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('member', 'manager')
    )
    AND EXISTS (
      SELECT 1 FROM recordings 
      WHERE recordings.id = workspace_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can delete entries"
  ON workspace_entries FOR DELETE
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "Members can delete own entries"
  ON workspace_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('member', 'manager')
    )
    AND EXISTS (
      SELECT 1 FROM recordings 
      WHERE recordings.id = workspace_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS POLICIES FOR RECORDINGS
-- =============================================================================
DROP POLICY IF EXISTS "Users can view recordings in their banks" ON recordings;
DROP POLICY IF EXISTS "Recording owners can update their recordings" ON recordings;
DROP POLICY IF EXISTS "Bank members can create recordings" ON recordings;
DROP POLICY IF EXISTS "Recording owners can delete their recordings" ON recordings;

CREATE POLICY "Users can view recordings in their organizations"
  ON recordings FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Recording owners can update their recordings"
  ON recordings FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Organization members can create recordings"
  ON recordings FOR INSERT
  WITH CHECK (is_organization_member(organization_id, auth.uid()) AND owner_user_id = auth.uid());

CREATE POLICY "Recording owners can delete their recordings"
  ON recordings FOR DELETE
  USING (
    owner_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM workspace_entries WHERE workspace_entries.recording_id = recordings.id
    )
  );

-- =============================================================================
-- RLS POLICIES FOR FOLDERS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view folders" ON folders;
DROP POLICY IF EXISTS "Users can create folders" ON folders;
DROP POLICY IF EXISTS "Users can update folders" ON folders;
DROP POLICY IF EXISTS "Users can delete folders" ON folders;

CREATE POLICY "Users can view folders"
  ON folders FOR SELECT
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND is_workspace_member(workspace_id, auth.uid()))
  );

CREATE POLICY "Users can create folders"
  ON folders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1 FROM workspace_memberships
        WHERE workspace_memberships.workspace_id = folders.workspace_id
          AND workspace_memberships.user_id = auth.uid()
          AND workspace_memberships.role IN ('workspace_owner', 'workspace_admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can update folders"
  ON folders FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND is_workspace_admin_or_owner(workspace_id, auth.uid()))
  );

CREATE POLICY "Users can delete folders"
  ON folders FOR DELETE
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND is_workspace_admin_or_owner(workspace_id, auth.uid()))
  );


-- Also handle workspace_invitations which used vault_memberships
DROP POLICY IF EXISTS "workspace_admins_select_invitations" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_admins_insert_invitations" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_admins_update_invitations" ON public.workspace_invitations;
DROP POLICY IF EXISTS "invited_users_select_own_invitations" ON public.workspace_invitations;

CREATE POLICY "workspace_admins_select_invitations"
  ON public.workspace_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships vm
      WHERE vm.workspace_id = workspace_invitations.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('workspace_owner', 'workspace_admin')
    )
  );

CREATE POLICY "workspace_admins_insert_invitations"
  ON public.workspace_invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (
      SELECT 1 FROM public.workspace_memberships vm
      WHERE vm.workspace_id = workspace_invitations.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('workspace_owner', 'workspace_admin')
    )
  );

CREATE POLICY "workspace_admins_update_invitations"
  ON public.workspace_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships vm
      WHERE vm.workspace_id = workspace_invitations.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('workspace_owner', 'workspace_admin')
    )
  );

CREATE POLICY "invited_users_select_own_invitations"
  ON public.workspace_invitations
  FOR SELECT
  USING (
    email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

COMMIT;
