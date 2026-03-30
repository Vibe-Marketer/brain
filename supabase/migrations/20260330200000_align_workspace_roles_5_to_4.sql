-- Migration: Align workspace roles from 5 to 4
-- Purpose: Rename 'manager' to 'contributor', drop 'guest' (upgrade to 'member').
--          The v2.0 decision locks 4 roles: workspace_owner, workspace_admin, contributor, member.
-- Date: 2026-03-30

BEGIN;

-- ============================================================================
-- STEP 1: Migrate existing data — manager → contributor, guest → member
-- ============================================================================
UPDATE public.workspace_memberships SET role = 'contributor' WHERE role = 'manager';
UPDATE public.workspace_memberships SET role = 'member' WHERE role = 'guest';

-- ============================================================================
-- STEP 2: Replace workspace_memberships CHECK constraint (4 roles only)
-- ============================================================================
ALTER TABLE public.workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;
ALTER TABLE public.workspace_memberships ADD CONSTRAINT workspace_memberships_role_check
  CHECK (role IN ('workspace_owner', 'workspace_admin', 'contributor', 'member'));

-- ============================================================================
-- STEP 3: Replace organization_memberships CHECK constraint if it references
--         'manager' or 'guest' (org roles are separate but may share old names)
-- ============================================================================
-- Only update org membership if 'manager' or 'guest' appear in the org constraint;
-- org roles use organization_owner/organization_admin/organization_member but
-- the original migration included 'manager'/'guest' as allowed values.
ALTER TABLE public.organization_memberships DROP CONSTRAINT IF EXISTS organization_memberships_role_check;
ALTER TABLE public.organization_memberships ADD CONSTRAINT organization_memberships_role_check
  CHECK (role IN ('organization_owner', 'organization_admin', 'organization_member'));

-- ============================================================================
-- STEP 4: Replace workspace_invitations role CHECK constraint
--         Remove 'manager' and 'guest', add 'contributor'
-- ============================================================================
ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;
ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_role_check
  CHECK (role = ANY (ARRAY['workspace_admin'::text, 'contributor'::text, 'member'::text]));

-- Migrate any existing invitation rows with old role names
UPDATE public.workspace_invitations SET role = 'contributor' WHERE role = 'manager';
UPDATE public.workspace_invitations SET role = 'member' WHERE role = 'guest';

-- ============================================================================
-- STEP 5: Update RLS policies that reference 'manager' or 'guest'
-- ============================================================================

-- 5a: restrict_member_insert_entries — was ('workspace_owner', 'workspace_admin', 'manager')
--     Must reference 'contributor' now.
DROP POLICY IF EXISTS "Workspace members can create entries" ON public.workspace_entries;

CREATE POLICY "Workspace members can create entries"
  ON public.workspace_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('workspace_owner', 'workspace_admin', 'contributor')
    )
  );

-- 5b: "Members can update own entries" — was role IN ('member', 'manager')
DROP POLICY IF EXISTS "Members can update own entries" ON public.workspace_entries;

CREATE POLICY "Members can update own entries"
  ON public.workspace_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('member', 'contributor')
    )
    AND EXISTS (
      SELECT 1 FROM public.recordings
      WHERE recordings.id = workspace_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
  );

-- 5c: "Members can delete own entries" — was role IN ('member', 'manager')
DROP POLICY IF EXISTS "Members can delete own entries" ON public.workspace_entries;

CREATE POLICY "Members can delete own entries"
  ON public.workspace_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships
      WHERE workspace_memberships.workspace_id = workspace_entries.workspace_id
        AND workspace_memberships.user_id = auth.uid()
        AND workspace_memberships.role IN ('member', 'contributor')
    )
    AND EXISTS (
      SELECT 1 FROM public.recordings
      WHERE recordings.id = workspace_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENT: Rationale
-- ============================================================================
COMMENT ON CONSTRAINT workspace_memberships_role_check ON public.workspace_memberships
  IS 'v2.0 4-role model: workspace_owner > workspace_admin > contributor > member. manager renamed to contributor; guest dropped (upgraded to member).';

COMMIT;
