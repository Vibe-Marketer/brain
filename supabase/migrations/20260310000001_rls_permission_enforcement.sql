-- Migration: RLS Permission Enforcement — Gaps from Issue #97
-- Purpose:
--   1. Allow workspace members to leave workspaces themselves (self-removal)
--   2. Guard against removing the last workspace_owner
--   3. Add missing index for workspace_memberships lookup performance
--   4. Verify all critical tables have RLS enabled
-- Issue: #97
-- Date: 2026-03-10

-- ============================================================================
-- 1. Self-removal: allow any workspace member to leave (DELETE own membership)
-- ============================================================================
-- The existing policy only allows workspace_admin/owner to remove members.
-- This adds the ability for any user to remove themselves from a workspace
-- they are a member of, except if they are the last workspace_owner.

DROP POLICY IF EXISTS "Members can leave workspaces" ON workspace_memberships;

CREATE POLICY "Members can leave workspaces"
  ON workspace_memberships FOR DELETE
  USING (
    -- Only allow deleting your own membership row
    user_id = auth.uid()
    -- Prevent removing yourself if you are the sole workspace_owner
    AND NOT (
      role = 'workspace_owner'
      AND NOT EXISTS (
        SELECT 1 FROM workspace_memberships wm2
        WHERE wm2.workspace_id = workspace_memberships.workspace_id
          AND wm2.user_id <> auth.uid()
          AND wm2.role = 'workspace_owner'
      )
    )
  );

-- ============================================================================
-- 2. Guard: prevent removing last workspace owner via admin path too
-- ============================================================================
-- The trigger fires on any DELETE to workspace_memberships and raises an
-- exception if it would leave the workspace with no owner.

CREATE OR REPLACE FUNCTION public.prevent_last_workspace_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check when removing a workspace_owner
  IF OLD.role = 'workspace_owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_id = OLD.workspace_id
        AND user_id <> OLD.user_id
        AND role = 'workspace_owner'
    ) THEN
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
  'Trigger: raises exception if deleting the last workspace_owner membership. Applies to both admin removal and self-removal paths.';

-- ============================================================================
-- 3. Performance: index for workspace_memberships cascade lookups
-- ============================================================================
-- The recordings RLS policy joins workspace_entries → workspace_memberships.
-- This index speeds up the workspace_memberships lookup in that join path.

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_user
  ON workspace_memberships (workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user
  ON workspace_memberships (user_id);

-- ============================================================================
-- 4. Ensure RLS is enabled on all permission-sensitive tables
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
-- 5. Comment: Full permission model summary
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
