-- Migration: admin_delete_user orphan profile cleanup
-- Purpose:   Let the Admin Center hard-delete path clean up partially-deleted
--            users where auth.users is already gone but user_profiles,
--            mcp_tokens, and personal-org membership rows remain.
--
--            This preserves the existing service-role-only RPC boundary while
--            avoiding the UI failure mode where admin-manage-user returns a
--            generic non-2xx because Supabase Auth no longer has the target.
-- Date:      2026-06-13

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_exists BOOLEAN := FALSE;
  v_profile_exists BOOLEAN := FALSE;
  v_email TEXT;
  v_workspaces_deleted INT := 0;
  v_mcp_tokens_deleted INT := 0;
BEGIN
  SELECT TRUE, email INTO v_auth_exists, v_email
    FROM auth.users WHERE id = p_target_user_id;

  IF NOT COALESCE(v_auth_exists, FALSE) THEN
    SELECT TRUE, email INTO v_profile_exists, v_email
      FROM public.user_profiles WHERE user_id = p_target_user_id;
  END IF;

  IF NOT COALESCE(v_auth_exists, FALSE) AND NOT COALESCE(v_profile_exists, FALSE) THEN
    RETURN json_build_object(
      'deleted',        FALSE,
      'reason',         'user_not_found',
      'target_user_id', p_target_user_id
    );
  END IF;

  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces            DISABLE TRIGGER protect_default_workspace;
  ALTER TABLE public.workspaces            DISABLE TRIGGER tr_tombstone_workspace_slug_on_delete;
  ALTER TABLE public.organizations         DISABLE TRIGGER tr_tombstone_org_slug_on_delete;

  DELETE FROM public.mcp_tokens WHERE user_id = p_target_user_id;
  GET DIAGNOSTICS v_mcp_tokens_deleted = ROW_COUNT;

  WITH deleted_ws AS (
    DELETE FROM public.workspaces
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = p_target_user_id
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_workspaces_deleted FROM deleted_ws;

  DELETE FROM public.workspace_memberships WHERE user_id = p_target_user_id;
  DELETE FROM public.organization_memberships WHERE user_id = p_target_user_id;

  DELETE FROM public.organizations o
    WHERE o.type = 'personal'
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = o.id
      );

  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;
  ALTER TABLE public.workspaces            ENABLE TRIGGER tr_tombstone_workspace_slug_on_delete;
  ALTER TABLE public.organizations         ENABLE TRIGGER tr_tombstone_org_slug_on_delete;

  IF COALESCE(v_auth_exists, FALSE) THEN
    DELETE FROM auth.users WHERE id = p_target_user_id;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
    DELETE FROM public.user_profiles WHERE user_id = p_target_user_id;
  END IF;

  RETURN json_build_object(
    'deleted',            TRUE,
    'target_user_id',     p_target_user_id,
    'email',              v_email,
    'auth_user_existed',  COALESCE(v_auth_exists, FALSE),
    'workspaces_deleted', v_workspaces_deleted,
    'mcp_tokens_deleted', v_mcp_tokens_deleted,
    'ran_at',             NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
    ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;
    ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;
    ALTER TABLE public.workspaces            ENABLE TRIGGER tr_tombstone_workspace_slug_on_delete;
    ALTER TABLE public.organizations         ENABLE TRIGGER tr_tombstone_org_slug_on_delete;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO postgres;

COMMENT ON FUNCTION public.admin_delete_user(UUID) IS
  'Hard-deletes a user or orphaned user profile with sanctioned trigger-bypass cascade cleanup. '
  'Service-role only; the admin-manage-user edge function gates it behind has_role(ADMIN).';
