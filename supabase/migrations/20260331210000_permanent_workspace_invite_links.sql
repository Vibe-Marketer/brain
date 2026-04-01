-- Migration: Make shareable workspace invite links permanent (no expiry)
--
-- Problem: Shareable workspace invite links expired after 7 days, which makes
-- no sense for a reusable link. Only email-based invitations should expire.
--
-- Fix: Set invite_expires_at = NULL for shareable links (NULL = no expiry).
-- The WorkspaceJoin page already handles NULL expires_at gracefully.
-- Date: 2026-03-31

-- ============================================================================
-- UPDATE generate_workspace_invite RPC: no expiry for shareable links
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_workspace_invite(
  p_workspace_id UUID,
  p_force BOOLEAN DEFAULT false
)
RETURNS TABLE(invite_token TEXT, invite_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_existing_token TEXT;
  v_existing_expires TIMESTAMPTZ;
  v_token TEXT;
BEGIN
  -- Verify caller is workspace owner or admin
  SELECT role INTO v_role
  FROM workspace_memberships
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('workspace_owner', 'workspace_admin') THEN
    RAISE EXCEPTION 'Only workspace owners and admins can generate invite links';
  END IF;

  -- Return existing token if valid and not forcing regeneration
  SELECT w.invite_token, w.invite_expires_at
    INTO v_existing_token, v_existing_expires
  FROM workspaces w
  WHERE w.id = p_workspace_id;

  -- If not forcing and token exists (with no expiry or future expiry), return it
  IF NOT p_force
     AND v_existing_token IS NOT NULL
     AND (v_existing_expires IS NULL OR v_existing_expires > NOW()) THEN
    RETURN QUERY SELECT v_existing_token, v_existing_expires;
    RETURN;
  END IF;

  -- Generate new permanent token (NULL expiry = never expires)
  v_token := replace(replace(replace(
    encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '');

  UPDATE workspaces
  SET invite_token = v_token,
      invite_expires_at = NULL,  -- permanent link
      updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN QUERY SELECT v_token, NULL::TIMESTAMPTZ;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_workspace_invite(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.generate_workspace_invite(UUID, BOOLEAN) IS
  'Generates a permanent, reusable invite link for a workspace. '
  'Only workspace owners and admins can call this. '
  'invite_expires_at is NULL (permanent). Use p_force=true to regenerate.';

-- ============================================================================
-- Clear expiry on existing workspace invite tokens (make them permanent)
-- ============================================================================

UPDATE workspaces
SET invite_expires_at = NULL
WHERE invite_token IS NOT NULL
  AND invite_expires_at IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
