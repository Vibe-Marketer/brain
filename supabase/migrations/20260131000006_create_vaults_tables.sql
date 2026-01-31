-- Vaults and VaultMemberships Tables for Bank/Vault Architecture
-- Phase 09-03: Collaboration containers within banks
-- 
-- Vaults enable team/coach/community use cases within the bank boundary.
-- Each vault has its own membership and visibility controls.

-- =============================================================================
-- VAULTS TABLE
-- =============================================================================

-- Vaults: Collaboration containers within a bank
-- Types: personal, team, coach, community, client (only personal+team fully implemented in Phase 9)
CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vault_type TEXT NOT NULL CHECK (vault_type IN ('personal', 'team', 'coach', 'community', 'client')),
  default_sharelink_ttl_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for vaults
CREATE INDEX IF NOT EXISTS idx_vaults_bank_id ON vaults(bank_id);
CREATE INDEX IF NOT EXISTS idx_vaults_vault_type ON vaults(vault_type);

-- Updated_at trigger for vaults
CREATE OR REPLACE FUNCTION update_vaults_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vaults_updated_at ON vaults;
CREATE TRIGGER vaults_updated_at
  BEFORE UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION update_vaults_updated_at();

-- Enable RLS on vaults
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- VAULT_MEMBERSHIPS TABLE
-- =============================================================================

-- VaultMembership: Links users to vaults with roles
-- Role hierarchy: vault_owner > vault_admin > manager > member > guest
CREATE TABLE IF NOT EXISTS vault_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('vault_owner', 'vault_admin', 'manager', 'member', 'guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vault_id, user_id)
);

-- Indexes for vault_memberships
CREATE INDEX IF NOT EXISTS idx_vault_memberships_vault_id ON vault_memberships(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_memberships_user_id ON vault_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_memberships_role ON vault_memberships(role);

-- Enable RLS on vault_memberships
ALTER TABLE vault_memberships ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (prevent RLS recursion)
-- =============================================================================

-- SECURITY DEFINER helper to check vault membership (prevents RLS recursion)
CREATE OR REPLACE FUNCTION is_vault_member(p_vault_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault_memberships
    WHERE vault_id = p_vault_id AND user_id = p_user_id
  )
$$;

-- SECURITY DEFINER helper to check vault admin/owner
CREATE OR REPLACE FUNCTION is_vault_admin_or_owner(p_vault_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault_memberships
    WHERE vault_id = p_vault_id 
      AND user_id = p_user_id
      AND role IN ('vault_owner', 'vault_admin')
  )
$$;

-- SECURITY DEFINER helper to get vault's bank_id
CREATE OR REPLACE FUNCTION get_vault_bank_id(p_vault_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bank_id FROM vaults WHERE id = p_vault_id
$$;

-- =============================================================================
-- RLS POLICIES FOR VAULTS
-- =============================================================================

-- Users can see vaults they're a member of
CREATE POLICY "Users can view vaults they belong to"
  ON vaults FOR SELECT
  USING (is_vault_member(id, auth.uid()));

-- Bank admins/owners can also see all vaults in their banks
CREATE POLICY "Bank admins can view all bank vaults"
  ON vaults FOR SELECT
  USING (is_bank_admin_or_owner(bank_id, auth.uid()));

-- Vault owners/admins can update vault settings
CREATE POLICY "Vault owners/admins can update vaults"
  ON vaults FOR UPDATE
  USING (is_vault_admin_or_owner(id, auth.uid()));

-- Bank members can create vaults in banks they belong to
CREATE POLICY "Bank members can create vaults"
  ON vaults FOR INSERT
  WITH CHECK (is_bank_member(bank_id, auth.uid()));

-- Vault owners can delete vaults
CREATE POLICY "Vault owners can delete vaults"
  ON vaults FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships
      WHERE vault_memberships.vault_id = vaults.id
        AND vault_memberships.user_id = auth.uid()
        AND vault_memberships.role = 'vault_owner'
    )
  );

-- =============================================================================
-- RLS POLICIES FOR VAULT_MEMBERSHIPS
-- =============================================================================

-- Users can view memberships in their vaults
CREATE POLICY "Users can view vault memberships"
  ON vault_memberships FOR SELECT
  USING (is_vault_member(vault_id, auth.uid()));

-- Bank admins can see all vault memberships in their banks
CREATE POLICY "Bank admins can view all vault memberships"
  ON vault_memberships FOR SELECT
  USING (
    is_bank_admin_or_owner(get_vault_bank_id(vault_id), auth.uid())
  );

-- Vault admins/owners can manage memberships
CREATE POLICY "Vault admins can insert memberships"
  ON vault_memberships FOR INSERT
  WITH CHECK (is_vault_admin_or_owner(vault_id, auth.uid()));

-- Users can create their own membership when creating vault
CREATE POLICY "Users can create own vault membership"
  ON vault_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Vault admins can update memberships"
  ON vault_memberships FOR UPDATE
  USING (is_vault_admin_or_owner(vault_id, auth.uid()));

CREATE POLICY "Vault admins can remove members"
  ON vault_memberships FOR DELETE
  USING (is_vault_admin_or_owner(vault_id, auth.uid()));

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE vaults IS 'Collaboration containers within a bank where sharing and work happens';
COMMENT ON COLUMN vaults.vault_type IS 'Type of vault: personal, team, coach, community, client';
COMMENT ON COLUMN vaults.default_sharelink_ttl_days IS 'Default TTL for share links created in this vault (7 days)';

COMMENT ON TABLE vault_memberships IS 'Links users to vaults with role-based access control';
COMMENT ON COLUMN vault_memberships.role IS 'Role hierarchy: vault_owner > vault_admin > manager > member > guest';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
