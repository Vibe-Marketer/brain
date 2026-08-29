-- Migration: Let org-level invites grant access to a chosen subset of workspaces
-- Ticket 6327283e: previously accept_organization_invite() always added the
-- invitee to only the organization's single "home" workspace, regardless of
-- what the inviter intended. This adds a join table for the inviter to record
-- which workspaces (and role per workspace) the invite should grant, and
-- updates accept_organization_invite() to honor it. Invites with no recorded
-- selection (created before this migration) keep the old home-workspace-only
-- behavior.

BEGIN;

-- ============================================================================
-- TABLE: organization_invitation_workspaces
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organization_invitation_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_invitation_id UUID NOT NULL REFERENCES public.organization_invitations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('workspace_owner', 'workspace_admin', 'contributor', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_invitation_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS organization_invitation_workspaces_invitation_idx
ON public.organization_invitation_workspaces (organization_invitation_id);

ALTER TABLE public.organization_invitation_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org Admins/Owners can manage invite workspace selections"
ON public.organization_invitation_workspaces
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_invitations oi
    JOIN public.organization_memberships om ON om.organization_id = oi.organization_id
    WHERE oi.id = organization_invitation_workspaces.organization_invitation_id
      AND om.user_id = auth.uid()
      AND om.role IN ('organization_owner', 'organization_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_invitations oi
    JOIN public.organization_memberships om ON om.organization_id = oi.organization_id
    WHERE oi.id = organization_invitation_workspaces.organization_invitation_id
      AND om.user_id = auth.uid()
      AND om.role IN ('organization_owner', 'organization_admin')
  )
);

COMMENT ON TABLE public.organization_invitation_workspaces IS
'Per-workspace access grants attached to an organization_invitations row. Populated by the inviter when creating an org-level invite; consumed by accept_organization_invite() to grant workspace_memberships on acceptance.';

-- ============================================================================
-- FUNCTION: accept_organization_invite — honor recorded workspace selections
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
  v_workspace_count INT;
  v_granted_workspace_ids UUID[] := '{}';
  v_ws RECORD;
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

  -- Grant access to whatever workspaces the inviter selected for this invite
  SELECT COUNT(*) INTO v_workspace_count
  FROM public.organization_invitation_workspaces
  WHERE organization_invitation_id = v_invitation.id;

  IF v_workspace_count > 0 THEN
    FOR v_ws IN
      SELECT workspace_id, role
      FROM public.organization_invitation_workspaces
      WHERE organization_invitation_id = v_invitation.id
    LOOP
      INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
      VALUES (v_ws.workspace_id, p_user_id, v_ws.role)
      ON CONFLICT (workspace_id, user_id) DO UPDATE
        SET role = EXCLUDED.role;

      v_granted_workspace_ids := array_append(v_granted_workspace_ids, v_ws.workspace_id);
    END LOOP;
  ELSE
    -- Legacy fallback for invites created before workspace selection existed:
    -- grant access to the org's home workspace only (previous behavior).
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

    INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
    VALUES (v_home_workspace_id, p_user_id, 'member')
    ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET role = 'member';

    v_granted_workspace_ids := array_append(v_granted_workspace_ids, v_home_workspace_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'home_workspace_id', v_home_workspace_id,
    'workspace_ids', to_jsonb(v_granted_workspace_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_organization_invite(TEXT, UUID) TO authenticated;

COMMIT;
