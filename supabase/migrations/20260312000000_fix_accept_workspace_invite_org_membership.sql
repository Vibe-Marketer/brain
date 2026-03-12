-- Migration: Fix accept_workspace_invite to also add org membership
-- Issue: Email-based workspace invites only added workspace_memberships,
--        leaving users without org membership → RLS violations.
-- Fix: After inserting workspace_membership, upsert organization_memberships.

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
  IF v_organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (organization_id, user_id, role)
    VALUES (v_organization_id, p_user_id, 'member')
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
