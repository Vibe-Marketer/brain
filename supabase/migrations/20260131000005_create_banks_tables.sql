-- Banks and BankMemberships Tables for Bank/Vault Architecture
-- Phase 09-02: Top-level tenant isolation layer
-- 
-- Banks are the hard security boundary - nothing crosses banks unless explicitly copied.
-- This migration creates the foundation for multi-tenant isolation.

-- =============================================================================
-- BANKS TABLE
-- =============================================================================

-- Banks: Top-level tenant container
-- Each bank is a completely separate security boundary
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('personal', 'business')),
  cross_bank_default TEXT DEFAULT 'copy_only' CHECK (cross_bank_default IN ('copy_only', 'copy_and_remove')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for banks
CREATE INDEX IF NOT EXISTS idx_banks_type ON banks(type);

-- Updated_at trigger for banks
CREATE OR REPLACE FUNCTION update_banks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banks_updated_at ON banks;
CREATE TRIGGER banks_updated_at
  BEFORE UPDATE ON banks
  FOR EACH ROW
  EXECUTE FUNCTION update_banks_updated_at();

-- Enable RLS on banks
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- BANK_MEMBERSHIPS TABLE
-- =============================================================================

-- BankMembership: Links users to banks with roles
CREATE TABLE IF NOT EXISTS bank_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('bank_owner', 'bank_admin', 'bank_member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bank_id, user_id)
);

-- Indexes for bank_memberships
CREATE INDEX IF NOT EXISTS idx_bank_memberships_bank_id ON bank_memberships(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_memberships_user_id ON bank_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_memberships_role ON bank_memberships(role);

-- Enable RLS on bank_memberships
ALTER TABLE bank_memberships ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (prevent RLS recursion)
-- =============================================================================

-- SECURITY DEFINER helper to check bank membership (prevents RLS recursion)
CREATE OR REPLACE FUNCTION is_bank_member(p_bank_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bank_memberships
    WHERE bank_id = p_bank_id AND user_id = p_user_id
  )
$$;

-- SECURITY DEFINER helper to check bank admin/owner
CREATE OR REPLACE FUNCTION is_bank_admin_or_owner(p_bank_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bank_memberships
    WHERE bank_id = p_bank_id 
      AND user_id = p_user_id
      AND role IN ('bank_owner', 'bank_admin')
  )
$$;

-- =============================================================================
-- RLS POLICIES FOR BANKS
-- =============================================================================

-- Users can view banks they belong to
CREATE POLICY "Users can view banks they belong to"
  ON banks FOR SELECT
  USING (is_bank_member(id, auth.uid()));

-- Bank owners/admins can update their banks
CREATE POLICY "Bank owners/admins can update their banks"
  ON banks FOR UPDATE
  USING (is_bank_admin_or_owner(id, auth.uid()));

-- Any user can create a bank
CREATE POLICY "Any user can create a bank"
  ON banks FOR INSERT
  WITH CHECK (true);

-- Bank owners can delete their banks
CREATE POLICY "Bank owners can delete their banks"
  ON banks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_memberships.bank_id = banks.id
        AND bank_memberships.user_id = auth.uid()
        AND bank_memberships.role = 'bank_owner'
    )
  );

-- =============================================================================
-- RLS POLICIES FOR BANK_MEMBERSHIPS
-- =============================================================================

-- Users can view memberships in their banks
CREATE POLICY "Users can view memberships in their banks"
  ON bank_memberships FOR SELECT
  USING (is_bank_member(bank_id, auth.uid()));

-- Bank admins/owners can manage memberships
CREATE POLICY "Bank admins/owners can manage memberships"
  ON bank_memberships FOR INSERT
  WITH CHECK (is_bank_admin_or_owner(bank_id, auth.uid()));

-- Bank admins/owners can update memberships
CREATE POLICY "Bank admins/owners can update memberships"
  ON bank_memberships FOR UPDATE
  USING (is_bank_admin_or_owner(bank_id, auth.uid()));

-- Bank admins/owners can remove members
CREATE POLICY "Bank admins/owners can remove members"
  ON bank_memberships FOR DELETE
  USING (is_bank_admin_or_owner(bank_id, auth.uid()));

-- Allow users to create their own membership (for initial bank creation)
CREATE POLICY "Users can create their own initial membership"
  ON bank_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());
