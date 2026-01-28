-- Migration: Fix infinite recursion in team_memberships RLS policy
-- Purpose: Replace self-referencing RLS policy with SECURITY DEFINER helper function
-- Author: Claude Code
-- Date: 2026-01-28
--
-- Problem: The team_memberships SELECT policy contains a self-reference:
--   EXISTS (SELECT 1 FROM team_memberships AS my_membership WHERE ...)
-- When any table (like content_library) has an RLS policy that queries team_memberships,
-- PostgreSQL evaluates team_memberships RLS which triggers another team_memberships check,
-- causing "infinite recursion detected in policy for relation 'team_memberships'"

-- ============================================================================
-- STEP 1: Create SECURITY DEFINER helper function
-- ============================================================================
-- This function bypasses RLS when checking membership status, breaking the recursion chain.
-- SECURITY DEFINER runs with the privileges of the function creator (superuser),
-- so it can read team_memberships without triggering RLS policies.

CREATE OR REPLACE FUNCTION is_active_team_member(
  p_team_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_id = p_team_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_active_team_member(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_active_team_member IS
  'Checks if a user is an active member of a team. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion when used in other RLS policies.';

-- ============================================================================
-- STEP 2: Drop existing team_memberships SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view memberships in their teams" ON team_memberships;

-- ============================================================================
-- STEP 3: Create new non-recursive SELECT policy
-- ============================================================================
-- The new policy uses the SECURITY DEFINER function instead of a self-referencing subquery.

CREATE POLICY "Users can view memberships in their teams"
  ON team_memberships
  FOR SELECT
  USING (
    -- Users can see memberships in teams they belong to (via helper function)
    is_active_team_member(team_memberships.team_id, auth.uid())
    OR
    -- Users can see their own pending memberships (e.g., invitations)
    (team_memberships.user_id = auth.uid())
    OR
    -- Team owners can see all memberships in their teams
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: Fix INSERT policy (also has self-reference)
-- ============================================================================
DROP POLICY IF EXISTS "Team admins can create memberships" ON team_memberships;

-- Create helper function for admin check
CREATE OR REPLACE FUNCTION is_team_admin(
  p_team_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_id = p_team_id
      AND user_id = p_user_id
      AND role = 'admin'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_team_admin(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_team_admin IS
  'Checks if a user is an admin of a team. Uses SECURITY DEFINER to bypass RLS.';

CREATE POLICY "Team admins can create memberships"
  ON team_memberships
  FOR INSERT
  WITH CHECK (
    -- Team admins can invite
    is_team_admin(team_memberships.team_id, auth.uid())
    OR
    -- Team owners can always invite
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 5: Fix UPDATE policy (also has self-reference)
-- ============================================================================
DROP POLICY IF EXISTS "Team admins and members can update memberships" ON team_memberships;

CREATE POLICY "Team admins and members can update memberships"
  ON team_memberships
  FOR UPDATE
  USING (
    -- User updating their own membership (e.g., accepting invite)
    team_memberships.user_id = auth.uid()
    OR
    -- Admin updating any membership
    is_team_admin(team_memberships.team_id, auth.uid())
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
    is_team_admin(team_memberships.team_id, auth.uid())
    OR
    -- Team owner can update any membership
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Fix DELETE policy (also has self-reference)
-- ============================================================================
DROP POLICY IF EXISTS "Team admins can delete memberships" ON team_memberships;

CREATE POLICY "Team admins can delete memberships"
  ON team_memberships
  FOR DELETE
  USING (
    -- User deleting their own membership (leaving team)
    team_memberships.user_id = auth.uid()
    OR
    -- Admin deleting any membership
    is_team_admin(team_memberships.team_id, auth.uid())
    OR
    -- Team owner can delete any membership
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_memberships.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
