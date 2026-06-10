-- Phase 06.1 Security: Revocation triggers covering both mcp_tokens and mcp_oauth_client_grants
-- ISC-27–34: Close the auth-bypass gap where OAuth-authenticated sessions survive membership removal.
-- ISC-32: Trigger failures are non-fatal — logged as WARNING, never roll back the membership DELETE.
-- ISC-34 anti: Only the removed user's tokens are revoked (OLD.user_id), never the whole workspace.

-- ============================================================================
-- TRIGGER FUNCTION: revoke_mcp_on_workspace_member_delete
-- Fires AFTER DELETE on workspace_memberships.
-- Revokes all active mcp_tokens and mcp_oauth_client_grants for the removed user in the workspace.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_mcp_on_workspace_member_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  BEGIN
    UPDATE public.mcp_tokens
      SET revoked_at = now()
      WHERE user_id     = OLD.user_id
        AND workspace_id = OLD.workspace_id
        AND revoked_at  IS NULL;

    UPDATE public.mcp_oauth_client_grants
      SET revoked_at = now()
      WHERE user_id     = OLD.user_id
        AND workspace_id = OLD.workspace_id
        AND revoked_at  IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'revoke_mcp_on_workspace_member_delete: failed for user=% workspace=% err=%',
      OLD.user_id, OLD.workspace_id, SQLERRM;
  END;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.revoke_mcp_on_workspace_member_delete() IS
  'Revokes mcp_tokens and mcp_oauth_client_grants for a user removed from a workspace. Non-fatal (ISC-32).';

-- ============================================================================
-- TRIGGER: tr_revoke_mcp_on_workspace_member_delete
-- ============================================================================
DROP TRIGGER IF EXISTS tr_revoke_mcp_on_workspace_member_delete ON public.workspace_memberships;
CREATE TRIGGER tr_revoke_mcp_on_workspace_member_delete
  AFTER DELETE ON public.workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_mcp_on_workspace_member_delete();

-- ============================================================================
-- TRIGGER FUNCTION: revoke_mcp_on_org_member_delete
-- Fires AFTER DELETE on organization_memberships.
-- Revokes all active mcp_tokens and mcp_oauth_client_grants for the removed user in the org.
-- Note: organization_memberships.organization_id maps to mcp_tokens.org_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_mcp_on_org_member_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  BEGIN
    UPDATE public.mcp_tokens
      SET revoked_at = now()
      WHERE user_id    = OLD.user_id
        AND org_id     = OLD.organization_id
        AND revoked_at IS NULL;

    UPDATE public.mcp_oauth_client_grants
      SET revoked_at = now()
      WHERE user_id    = OLD.user_id
        AND org_id     = OLD.organization_id
        AND revoked_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'revoke_mcp_on_org_member_delete: failed for user=% org=% err=%',
      OLD.user_id, OLD.organization_id, SQLERRM;
  END;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.revoke_mcp_on_org_member_delete() IS
  'Revokes mcp_tokens and mcp_oauth_client_grants for a user removed from an organization. Non-fatal (ISC-32).';

-- ============================================================================
-- TRIGGER: tr_revoke_mcp_on_org_member_delete
-- ============================================================================
DROP TRIGGER IF EXISTS tr_revoke_mcp_on_org_member_delete ON public.organization_memberships;
CREATE TRIGGER tr_revoke_mcp_on_org_member_delete
  AFTER DELETE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_mcp_on_org_member_delete();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
