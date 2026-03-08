-- Phase 5: Organization Invitations Support

-- RPC to get details for an organization invite (unauthenticated)
CREATE OR REPLACE FUNCTION public.get_organization_invite_details(p_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
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
    oi.id,
    o.name::TEXT,
    p.display_name::TEXT,
    oi.role,
    oi.expires_at
  FROM organization_invitations oi
  JOIN organizations o ON o.id = oi.organization_id
  JOIN user_profiles p ON p.user_id = oi.invited_by
  WHERE oi.invite_token = p_token
    AND oi.status = 'pending'
    AND oi.expires_at > NOW();
END;
$$;

-- RPC to accept an organization invite
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

  -- Create organization membership
  -- The invitation role values now match organization_memberships role values directly
  -- (organization_owner, organization_admin, member)
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, p_user_id, v_invitation.role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE organization_invitations
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id
  );
END;
$$;
