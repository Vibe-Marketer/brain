-- Migration: Workspace Redesign Schema Foundation
-- Purpose: Additive schema changes for Phase 16 Workspace Redesign
--   1. workspace_invitations table (for email invite tracking)
--   2. folders.vault_id FK (workspace scoping for folders)
--   3. folders.is_archived + archived_at columns
--   4. vaults.is_default column + backfill for existing personal vaults
--   5. Updated handle_new_user() trigger (sets is_default = TRUE)
--   6. get_workspace_invite_details RPC (unauthenticated join page)
--   7. accept_workspace_invite RPC
--   8. protect_default_workspace trigger (prevents deletion of default vault)
-- Date: 2026-02-28

-- =============================================================================
-- 1. workspace_invitations TABLE
-- =============================================================================
-- Tracks email-based workspace invitations (WKSP-10/11)

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('vault_admin', 'manager', 'member', 'guest')),
  token VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(workspace_id, email, status)
);

-- Indexes for common lookup patterns
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON public.workspace_invitations(status);

-- RLS
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace admins/owners can SELECT all invitations for their workspace
CREATE POLICY "workspace_admins_select_invitations"
  ON public.workspace_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_memberships vm
      WHERE vm.vault_id = workspace_invitations.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('vault_owner', 'vault_admin')
    )
  );

-- Workspace admins/owners can INSERT invitations for their workspace
CREATE POLICY "workspace_admins_insert_invitations"
  ON public.workspace_invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (
      SELECT 1 FROM public.vault_memberships vm
      WHERE vm.vault_id = workspace_invitations.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('vault_owner', 'vault_admin')
    )
  );

-- Workspace admins/owners can UPDATE (revoke) invitations for their workspace
CREATE POLICY "workspace_admins_update_invitations"
  ON public.workspace_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_memberships vm
      WHERE vm.vault_id = workspace_invitations.workspace_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('vault_owner', 'vault_admin')
    )
  );

-- Invited users can SELECT their own pending invitations by email
CREATE POLICY "invited_users_select_own_invitations"
  ON public.workspace_invitations
  FOR SELECT
  USING (
    email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE public.workspace_invitations IS
  'Email-based workspace invitations. Tokens expire after 7 days. Accepted invites create vault_memberships rows.';

-- =============================================================================
-- 2. folders.vault_id FK (workspace scoping)
-- =============================================================================
-- Critical schema gap identified in Phase 16 research.
-- Allows folders to be scoped to a specific workspace (vault).

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS vault_id UUID REFERENCES public.vaults(id) ON DELETE SET NULL;

-- Backfill: set vault_id to the first vault in the same bank (ordered by created_at)
-- This ensures existing folders are associated with the oldest/primary vault per bank
UPDATE public.folders f
SET vault_id = (
  SELECT v.id
  FROM public.vaults v
  WHERE v.bank_id = f.bank_id
  ORDER BY v.created_at ASC
  LIMIT 1
)
WHERE f.vault_id IS NULL
  AND f.bank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_folders_vault_id ON public.folders(vault_id);

COMMENT ON COLUMN public.folders.vault_id IS
  'Workspace (vault) this folder belongs to. Set during folder creation. Backfilled from first vault in bank for existing folders.';

-- =============================================================================
-- 3. folders.is_archived + folders.archived_at (WKSP-12 archive support)
-- =============================================================================

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_folders_is_archived ON public.folders(is_archived)
  WHERE is_archived = TRUE;

COMMENT ON COLUMN public.folders.is_archived IS
  'Whether this folder has been archived. Archived folders are hidden from the main view but preserved.';
COMMENT ON COLUMN public.folders.archived_at IS
  'Timestamp when the folder was archived. NULL if not archived.';

-- =============================================================================
-- 4. vaults.is_default column (WKSP-07 default workspace protection)
-- =============================================================================

ALTER TABLE public.vaults
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- CRITICAL BACKFILL: Mark all existing personal vaults as default.
-- Without this, the protect_default_workspace trigger (step 8) can never fire
-- because no vault would have is_default = TRUE.
-- Every existing personal vault must be marked as the default workspace.
UPDATE public.vaults
SET is_default = TRUE
WHERE vault_type = 'personal';

CREATE INDEX IF NOT EXISTS idx_vaults_is_default ON public.vaults(is_default)
  WHERE is_default = TRUE;

COMMENT ON COLUMN public.vaults.is_default IS
  'Whether this is the default (undeletable) workspace for the owning user. Set to TRUE for all personal vaults. Cannot be deleted while TRUE.';

-- =============================================================================
-- 5. Updated handle_new_user() trigger
-- =============================================================================
-- Extends the existing trigger to set is_default = TRUE on the personal vault
-- created at signup. New users always get a protected default workspace.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
BEGIN
  -- Insert profile for new user
  INSERT INTO public.user_profiles (user_id, email, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false
  );

  -- Assign default FREE role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create personal bank for new user
  INSERT INTO banks (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_bank_id;

  -- Create bank membership as owner
  INSERT INTO bank_memberships (bank_id, user_id, role)
  VALUES (v_bank_id, NEW.id, 'bank_owner');

  -- Create default personal vault with is_default = TRUE
  INSERT INTO vaults (bank_id, name, vault_type, is_default)
  VALUES (v_bank_id, 'My Calls', 'personal', TRUE)
  RETURNING id INTO v_vault_id;

  -- Create vault membership as owner
  INSERT INTO vault_memberships (vault_id, user_id, role)
  VALUES (v_vault_id, NEW.id, 'vault_owner');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically create user profile, FREE role, personal bank, and personal vault (is_default=TRUE) on signup';

-- =============================================================================
-- 6. get_workspace_invite_details RPC
-- =============================================================================
-- SECURITY DEFINER: allows unauthenticated users to see invite context before
-- accepting (e.g., which workspace and organization they are being invited to).

CREATE OR REPLACE FUNCTION public.get_workspace_invite_details(p_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  workspace_name TEXT,
  organization_name TEXT,
  inviter_display_name TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id,
    v.name::TEXT,
    b.name::TEXT,
    (u.raw_user_meta_data->>'full_name')::TEXT,
    wi.role,
    wi.expires_at
  FROM workspace_invitations wi
  JOIN vaults v ON v.id = wi.workspace_id
  JOIN banks b ON b.id = v.bank_id
  JOIN auth.users u ON u.id = wi.invited_by
  WHERE wi.token = p_token
    AND wi.status = 'pending'
    AND wi.expires_at > NOW();
END;
$$;

COMMENT ON FUNCTION public.get_workspace_invite_details(TEXT) IS
  'Returns workspace invitation context by token. SECURITY DEFINER allows unauthenticated access for the /join/workspace/:token page.';

-- =============================================================================
-- 7. accept_workspace_invite RPC
-- =============================================================================
-- SECURITY DEFINER: accepts an invite token on behalf of the calling user.
-- Validates token is pending and not expired, creates vault_memberships row,
-- marks invitation as accepted.

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(
  p_token TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation workspace_invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  -- Verify the calling user matches the p_user_id parameter
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'User ID mismatch');
  END IF;

  -- Look up the invitation
  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation not found, already used, or expired');
  END IF;

  -- Verify the invited email matches the authenticated user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS DISTINCT FROM v_invitation.email THEN
    RETURN jsonb_build_object('error', 'This invitation was sent to a different email address');
  END IF;

  -- Create vault membership (on conflict: update role to invited role)
  INSERT INTO public.vault_memberships (vault_id, user_id, role)
  VALUES (v_invitation.workspace_id, p_user_id, v_invitation.role)
  ON CONFLICT (vault_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE workspace_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_invitation.workspace_id,
    'role', v_invitation.role
  );
END;
$$;

COMMENT ON FUNCTION public.accept_workspace_invite(TEXT, UUID) IS
  'Accepts a workspace invitation by token. Validates email match, creates vault_memberships row, marks invitation accepted.';

-- =============================================================================
-- 8. protect_default_workspace trigger
-- =============================================================================
-- Prevents deletion of any vault where is_default = TRUE.
-- This is the safety net for the "My Calls" workspace.

CREATE OR REPLACE FUNCTION public.prevent_default_workspace_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_default = TRUE THEN
    RAISE EXCEPTION 'Cannot delete the default workspace';
  END IF;
  RETURN OLD;
END;
$$;

-- Drop and recreate trigger to ensure idempotency
DROP TRIGGER IF EXISTS protect_default_workspace ON public.vaults;

CREATE TRIGGER protect_default_workspace
BEFORE DELETE ON public.vaults
FOR EACH ROW EXECUTE FUNCTION public.prevent_default_workspace_delete();

COMMENT ON FUNCTION public.prevent_default_workspace_delete() IS
  'Trigger function: raises exception if attempting to DELETE a vault where is_default = TRUE.';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
