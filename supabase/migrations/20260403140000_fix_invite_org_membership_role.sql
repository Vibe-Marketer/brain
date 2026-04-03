-- Migration: Fix invite RPCs to use 'organization_member' instead of 'member'
-- Issue: The role alignment migration (20260330200000) tightened
--        organization_memberships_role_check to only allow
--        ('organization_owner', 'organization_admin', 'organization_member'),
--        but both accept_workspace_invite and accept_organization_invite still
--        inserted 'member', causing a CHECK constraint violation.
-- Also: Migrate any existing organization_invitations rows using 'member' role.

BEGIN;

-- ============================================================================
-- STEP 1: Fix accept_workspace_invite — use 'organization_member' not 'member'
-- ============================================================================
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
  v_organization_id UUID;
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

  -- Look up the workspace's organization_id
  SELECT organization_id INTO v_organization_id
  FROM workspaces
  WHERE id = v_invitation.workspace_id;

  -- Ensure user is an org member first (upsert, no-op if already member)
  -- FIX: use 'organization_member' to match constraint
  IF v_organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (organization_id, user_id, role)
    VALUES (v_organization_id, p_user_id, 'organization_member')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  -- Create workspace membership (on conflict: update role to invited role)
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, p_user_id, v_invitation.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
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

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT, UUID) TO authenticated;

-- ============================================================================
-- STEP 2: Fix accept_organization_invite — normalize role before inserting
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_organization_invite(
  p_token TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation organization_invitations%ROWTYPE;
  v_user_email TEXT;
  v_home_workspace_id UUID;
  v_org_name TEXT;
  v_effective_role TEXT;
BEGIN
  -- Verify the calling user matches the p_user_id parameter
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'User ID mismatch';
  END IF;

  -- Look up the invitation
  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE invite_token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already used, or expired';
  END IF;

  -- Verify the invited email matches the authenticated user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS DISTINCT FROM v_invitation.email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  -- Normalize role: map legacy 'member'/'guest' to 'organization_member'
  v_effective_role := CASE
    WHEN v_invitation.role IN ('member', 'guest') THEN 'organization_member'
    ELSE v_invitation.role
  END;

  -- Create organization membership
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, p_user_id, v_effective_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE organization_invitations
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = v_invitation.id;

  -- Find or create the home workspace for this org
  SELECT id INTO v_home_workspace_id
  FROM workspaces
  WHERE organization_id = v_invitation.organization_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_home_workspace_id IS NULL THEN
    SELECT name INTO v_org_name
    FROM organizations
    WHERE id = v_invitation.organization_id;

    INSERT INTO public.workspaces (organization_id, name, is_home)
    VALUES (v_invitation.organization_id, COALESCE(v_org_name, 'Home'), TRUE)
    RETURNING id INTO v_home_workspace_id;
  END IF;

  -- Add user to home workspace
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (v_home_workspace_id, p_user_id, 'member')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'member';

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'home_workspace_id', v_home_workspace_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_organization_invite(TEXT, UUID) TO authenticated;

-- ============================================================================
-- STEP 3: Fix existing org invitation rows that have 'member' as role
-- ============================================================================
UPDATE public.organization_invitations
SET role = 'organization_member'
WHERE role = 'member';

UPDATE public.organization_invitations
SET role = 'organization_admin'
WHERE role = 'admin';

-- ============================================================================
-- STEP 4: Fix any existing org membership rows that somehow have 'member'
-- ============================================================================
UPDATE public.organization_memberships
SET role = 'organization_member'
WHERE role = 'member';

COMMIT;
