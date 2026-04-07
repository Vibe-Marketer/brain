-- Migration: Add SECURITY DEFINER RPC for shareable workspace invite link lookup
-- Purpose: The workspaces table SELECT RLS blocks non-members from reading workspace
--          rows by invite_token. The shareable link join flow needs to read workspace
--          details (name, org name, expiry) before the user becomes a member.
--          This RPC bypasses RLS safely by returning only the invite-safe fields.
-- Date: 2026-04-07

-- ============================================================================
-- RPC: get_workspace_shareable_invite_details
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_workspace_shareable_invite_details(p_token TEXT)
RETURNS TABLE(
  workspace_id   UUID,
  workspace_name TEXT,
  organization_name TEXT,
  invite_expires_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.name::TEXT,
    o.name::TEXT,
    w.invite_expires_at
  FROM workspaces w
  JOIN organizations o ON o.id = w.organization_id
  WHERE w.invite_token = p_token
    AND (w.invite_expires_at IS NULL OR w.invite_expires_at > NOW());
END;
$$;

-- Only authenticated users can call this (logged-in users clicking invite links)
GRANT EXECUTE ON FUNCTION public.get_workspace_shareable_invite_details(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_workspace_shareable_invite_details(TEXT) IS
  'Returns workspace details for a shareable invite token, bypassing RLS. '
  'Returns zero rows if the token does not exist or has expired. '
  'Only exposes invite-safe fields: id, name, org name, expiry.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
