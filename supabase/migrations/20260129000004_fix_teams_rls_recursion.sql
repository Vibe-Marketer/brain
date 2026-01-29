-- Migration: Fix infinite recursion in teams RLS policy
-- Purpose: The teams SELECT policy has a subquery to team_memberships, causing recursion
--          when TeamSwitcher queries team_memberships with a JOIN to teams.
-- Date: 2026-01-29
--
-- Problem: When querying:
--   SELECT ... FROM team_memberships JOIN teams ON ...
-- The teams RLS policy checks team_memberships, which triggers team_memberships RLS,
-- which may need teams data, causing "infinite recursion detected in policy for relation 'teams'"
--
-- Solution: Use the existing is_active_team_member() SECURITY DEFINER function
-- that was created in 20260128000001_fix_team_memberships_rls_recursion.sql

-- ============================================================================
-- STEP 1: Drop existing teams SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view teams they belong to" ON teams;

-- ============================================================================
-- STEP 2: Create new non-recursive SELECT policy
-- ============================================================================
-- Use is_active_team_member() instead of direct subquery to team_memberships

CREATE POLICY "Users can view teams they belong to"
  ON teams
  FOR SELECT
  USING (
    -- Team owners can always see their teams
    auth.uid() = owner_user_id
    OR
    -- Members can see teams they belong to (via SECURITY DEFINER function)
    is_active_team_member(teams.id, auth.uid())
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
