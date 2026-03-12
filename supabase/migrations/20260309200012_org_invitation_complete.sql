-- Phase 5 follow-up: Complete org invitation support
--
-- 1. Add DEFAULT + UNIQUE to invite_token so frontend can INSERT without specifying token
-- 2. Update accept_organization_invite to also join the org's home workspace
-- 3. Add RPC to get org members with their display names

-- ============================================================================
-- FIX: invite_token default and unique constraint
-- ============================================================================

ALTER TABLE organization_invitations
  ALTER COLUMN invite_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_token_unique;

ALTER TABLE organization_invitations
  ADD CONSTRAINT organization_invitations_token_unique UNIQUE (invite_token);


-- ============================================================================
-- UPDATE: accept_organization_invite — also adds user to the home workspace
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
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, p_user_id, v_invitation.role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE organization_invitations
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = v_invitation.id;

  -- Auto-add user to the home workspace (if one exists for this org)
  SELECT id INTO v_home_workspace_id
  FROM workspaces
  WHERE organization_id = v_invitation.organization_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_home_workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
    VALUES (v_home_workspace_id, p_user_id, 'member')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'home_workspace_id', v_home_workspace_id
  );
END;
$$;


-- ============================================================================
-- RPC: get_org_members — returns org members with display names
-- Used by the frontend OrgMemberPanel. SECURITY DEFINER is NOT needed here
-- because the query is guarded by the caller's RLS session.
-- We use a regular function that runs as the caller.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_org_members(p_org_id UUID)
RETURNS TABLE (
  membership_id UUID,
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ,
  display_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a member of this org
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    om.id AS membership_id,
    om.user_id,
    om.role,
    om.created_at AS joined_at,
    up.display_name,
    u.email
  FROM organization_memberships om
  LEFT JOIN user_profiles up ON up.user_id = om.user_id
  LEFT JOIN auth.users u ON u.id = om.user_id
  WHERE om.organization_id = p_org_id
  ORDER BY om.created_at ASC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_invite_details(TEXT) TO anon, authenticated;
