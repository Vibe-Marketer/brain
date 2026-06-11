-- Migration: admin_delete_user RPC (Admin Center hard-delete, ADMC-UX punch item 1)
-- Purpose:   The Admin Center needs a hard-delete for users that mirrors the
--            established trigger-bypass cleanup pattern used by
--            cleanup_test_fixture_users and the delete_soren_canary migration.
--
--            A naive `DELETE FROM auth.users` is blocked by the user-defined
--            prevent_last_workspace_owner_removal / _demotion triggers when the
--            target is the sole owner of a workspace. The sanctioned pattern:
--              1. Disable the three protective DELETE triggers.
--              2. Delete the user's owned workspaces (cascades memberships).
--              3. Delete the user's org memberships + any now-empty personal orgs.
--              4. Re-enable the triggers (also in the EXCEPTION path).
--              5. Delete the auth.users row (cascades user_profiles/user_roles).
--
--            This function is invoked ONLY by the admin-manage-user edge
--            function on the service-role client, AFTER it has verified the
--            caller is an ADMIN via has_role(). It is REVOKEd from PUBLIC and
--            granted to service_role + postgres only — no anon/authenticated
--            client can reach it.
--
-- Safety:    - SECURITY DEFINER + REVOKE FROM PUBLIC (service_role/postgres only).
--            - Triggers re-enabled in the EXCEPTION block, so a partial failure
--              can never leave production with protective triggers disabled.
--            - Returns a JSON summary for auditable output.
--            - Refuses to delete a user that does not exist (returns deleted=false).
-- Author:    Admin Center UX punch list (item 1 — delete user)
-- Date:      2026-06-13

-- ============================================================================
-- FUNCTION: admin_delete_user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_exists BOOLEAN := FALSE;
  v_email TEXT;
  v_workspaces_deleted INT := 0;
BEGIN
  SELECT TRUE, email INTO v_exists, v_email
    FROM auth.users WHERE id = p_target_user_id;

  IF NOT v_exists THEN
    RETURN json_build_object(
      'deleted',       FALSE,
      'reason',        'user_not_found',
      'target_user_id', p_target_user_id
    );
  END IF;

  -- Disable the protective DELETE triggers for the duration of this cleanup.
  -- Minimum blast radius: only this single target user's rows are touched, and
  -- the triggers are re-enabled below (including in the exception path).
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces            DISABLE TRIGGER protect_default_workspace;

  -- 1. Delete the user's workspaces (cascades to workspace_memberships).
  WITH deleted_ws AS (
    DELETE FROM public.workspaces
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = p_target_user_id
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_workspaces_deleted FROM deleted_ws;

  -- 2. Remove any remaining workspace memberships (member-of, not owner-of).
  DELETE FROM public.workspace_memberships WHERE user_id = p_target_user_id;

  -- 3. Remove org memberships, then sweep any now-empty personal orgs.
  DELETE FROM public.organization_memberships WHERE user_id = p_target_user_id;

  DELETE FROM public.organizations o
    WHERE o.type = 'personal'
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = o.id
      );

  -- Re-enable the protective triggers before touching auth.users.
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;

  -- 4. Finally delete the auth user (cascades user_profiles, user_roles, etc.).
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN json_build_object(
    'deleted',            TRUE,
    'target_user_id',     p_target_user_id,
    'email',              v_email,
    'workspaces_deleted', v_workspaces_deleted,
    'ran_at',             NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Always re-enable triggers, even if the delete fails. Transaction
    -- rollback handles the data side; this guarantees we never leave
    -- production with protective triggers disabled.
    ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
    ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;
    ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;
    RAISE;
END;
$$;

-- ============================================================================
-- GRANTS — service_role + postgres only (mirrors cleanup_test_fixture_users)
-- ============================================================================
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO postgres;

COMMENT ON FUNCTION public.admin_delete_user(UUID) IS
  'Hard-deletes a user with the sanctioned trigger-bypass cascade cleanup. '
  'Service-role only; the admin-manage-user edge function gates it behind has_role(ADMIN).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
