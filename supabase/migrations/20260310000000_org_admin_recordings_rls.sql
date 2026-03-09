-- Migration: Add org admin SELECT policy on recordings
-- Issue: #100 — HOME workspace enforcement
--
-- Current state:
--   SELECT policies on recordings:
--     1. "Users can view own recordings" — owner_user_id = auth.uid()
--     2. "Users can view shared recordings in their workspaces" — workspace join
--   Missing: org admin/owner can see ALL recordings in their org regardless of workspace membership.
--
-- Per decision doc _decisions/boundaries.md §2:
--   "Org Owner/Admin: see all calls in all workspaces in that org."
--
-- Fix: Add a third SELECT policy so org admins/owners can see every recording
--      in any org they admin, regardless of workspace membership.
--
-- This is additive — existing policies are unchanged.
-- RLS is PERMISSIVE (OR semantics), so any matching policy grants access.

CREATE POLICY "Org admins can view all recordings in their org"
  ON recordings
  FOR SELECT
  USING (is_organization_admin_or_owner(organization_id, auth.uid()));

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
