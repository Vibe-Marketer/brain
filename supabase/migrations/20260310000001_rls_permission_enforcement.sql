-- Migration: RLS Permission Enforcement — Gaps from Issue #97
-- Purpose:
--   1. SECURITY DEFINER helper: has_other_workspace_owner()
--   2. Allow workspace members to leave workspaces themselves (self-removal)
--   3. Guard against removing the last workspace_owner (TOCTOU-safe trigger)
--   4. Note: workspace_memberships indexes already exist from vault rename; no new ones needed
--   5. Verify all critical tables have RLS enabled
-- Issue: #97
-- Date: 2026-03-10

-- ============================================================================
-- 1. Helper: check if a workspace has at least one OTHER owner
-- ============================================================================
-- SECURITY DEFINER so the subquery bypasses SELECT RLS on workspace_memberships.
-- Used by both the self-removal RLS policy and the BEFORE DELETE trigger.
-- Using a helper function isolates the check from future SELECT policy changes
-- and ensures consistent behavior across both code paths.

CREATE OR REPLACE FUNCTION public.has_other_workspace_owner(
  p_workspace_id UUID,
  p_excluded_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_memberships
    WHERE workspace_id = p_workspace_id
      AND user_id <> p_excluded_user_id
      AND role = 'workspace_owner'
  )
$$;

COMMENT ON FUNCTION public.has_other_workspace_owner(UUID, UUID) IS
  'Returns TRUE if the workspace has at least one workspace_owner other than the excluded user. SECURITY DEFINER to bypass SELECT RLS.';

-- ============================================================================
-- 2. Self-removal: allow any workspace member to leave (DELETE own membership)
-- ============================================================================
-- The existing policy only allows workspace_admin/owner to remove members.
-- This adds the ability for any user to remove themselves from a workspace
-- they are a member of, except if they are the last workspace_owner.
--
-- The last-owner check delegates to has_other_workspace_owner() (SECURITY DEFINER)
-- rather than an inline subquery on workspace_memberships. This prevents a
-- future tightening of the SELECT policy on workspace_memberships from silently
-- breaking the check by filtering out other owners.

DROP POLICY IF EXISTS "Members can leave workspaces" ON workspace_memberships;

CREATE POLICY "Members can leave workspaces"
  ON workspace_memberships FOR DELETE
  USING (
    -- Only allow deleting your own membership row
    user_id = auth.uid()
    -- Prevent removing yourself if you are the sole workspace_owner
    AND NOT (
      role = 'workspace_owner'
      AND NOT has_other_workspace_owner(workspace_id, auth.uid())
    )
  );

-- ============================================================================
-- 3. Guard: prevent removing last workspace owner via any path (TOCTOU-safe)
-- ============================================================================
-- The trigger is the authoritative last-owner guard. It fires BEFORE DELETE on
-- any path (admin removal, self-removal, or service role). It prevents the race
-- condition where two concurrent owner self-removals both pass the check and
-- both succeed, leaving the workspace ownerless.
--
-- TOCTOU fix: the trigger acquires a row-level FOR UPDATE lock on all owner
-- rows for this workspace before counting. This serializes concurrent removals —
-- if two owners try to leave simultaneously, one will block until the first
-- commits, then re-evaluate and fail if no other owner remains.

CREATE OR REPLACE FUNCTION public.prevent_last_workspace_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_owner_count INT;
BEGIN
  -- Only check when removing a workspace_owner row
  IF OLD.role = 'workspace_owner' THEN
    -- Lock all workspace_owner rows for this workspace to prevent concurrent
    -- deletions from both passing the "other owner exists" check.
    -- This is safe in a BEFORE DELETE trigger: the row being deleted still
    -- exists at this point, so we can lock it along with any other owners.
    PERFORM 1 FROM workspace_memberships
    WHERE workspace_id = OLD.workspace_id
      AND role = 'workspace_owner'
    FOR UPDATE;

    -- Count remaining owners excluding the one about to be deleted
    SELECT COUNT(*) INTO v_other_owner_count
    FROM workspace_memberships
    WHERE workspace_id = OLD.workspace_id
      AND user_id <> OLD.user_id
      AND role = 'workspace_owner';

    IF v_other_owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last workspace owner. Assign another owner first.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_workspace_owner ON workspace_memberships;

CREATE TRIGGER prevent_last_workspace_owner
BEFORE DELETE ON workspace_memberships
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_workspace_owner_removal();

COMMENT ON FUNCTION public.prevent_last_workspace_owner_removal() IS
  'Trigger: raises exception if deleting the last workspace_owner membership. Uses SELECT FOR UPDATE to prevent TOCTOU race between concurrent owner self-removals. Applies to all DELETE paths (admin removal, self-removal, service role).';

-- ============================================================================
-- 4. Performance: index notes for workspace_memberships cascade lookups
-- ============================================================================
-- The recordings RLS policy joins workspace_entries → workspace_memberships.
-- No new indexes needed here: workspace_memberships already has equivalent
-- coverage from the vault_memberships original schema (carried over via
-- ALTER TABLE vault_memberships RENAME TO workspace_memberships):
--
--   • UNIQUE(workspace_id, user_id)  — implicit unique index covering both columns
--   • idx_vault_memberships_user_id  — explicit index on (user_id)
--
-- Adding idx_workspace_memberships_workspace_user / idx_workspace_memberships_user
-- would be duplicate indexes with only a name difference, causing unnecessary
-- write amplification and storage overhead.

-- ============================================================================
-- 5. Ensure RLS is enabled on all permission-sensitive tables
-- ============================================================================
-- These should already be set from prior migrations, but we verify here.

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_folder_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_tag_recordings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Comment: Full permission model summary
-- ============================================================================
-- Recordings visibility tiers:
--   1. Org admin/owner (organization_owner, organization_admin):
--      See ALL recordings in their org via "Org admins can view all recordings"
--   2. Recording owner (owner_user_id = auth.uid()):
--      Always see their own recordings via "Users can view own recordings"
--   3. Regular members:
--      See recordings only from workspaces they belong to
--      via "Users can view recordings in their workspaces"
--
-- Cascade behavior:
--   - Deleting a workspace_memberships row instantly hides all recordings in
--     that workspace from the removed user (RLS evaluated at query time)
--   - Re-adding the membership restores access immediately
--   - personal_folder_recordings/personal_tag_recordings entries remain
--     in the DB but hidden recordings return NULL when joined
--
-- Decision docs:
--   _decisions/sharing.md       — What happens when removed
--   _decisions/boundaries.md    — Access boundary rules
--   _decisions/organization.md  — Org role FAQ
--
-- SQL tests:
--   supabase/tests/rls_permissions_test.sql

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
