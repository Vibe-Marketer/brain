-- Migration: admin_delete_user — bypass slug-tombstone triggers (punch item 1 fix)
-- Purpose:   The live delete probe surfaced a FK failure: deleting a user's
--            workspace fires tr_tombstone_workspace_slug_on_delete, which
--            inserts into workspace_slug_tombstone (FK → organizations). When
--            the user's personal org is swept in the same cascade, the tombstone
--            insert violates the FK ("Key (org_id)=... is not present in table
--            organizations").
--
--            For a HARD user delete we don't need to reserve the freed slugs —
--            the whole org is going away. So disable both slug-tombstone DELETE
--            triggers for the duration of the cleanup, alongside the existing
--            protective triggers. Re-enabled in the EXCEPTION path too.
--
--            Replaces the function created in 20260613120000. Idempotent
--            (CREATE OR REPLACE); grants re-asserted.
-- Author:    Admin Center UX punch list (item 1 — delete user, probe fix)
-- Date:      2026-06-13

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

  -- Disable the protective DELETE triggers AND the slug-tombstone triggers for
  -- the duration of this cleanup. Minimum blast radius: only this single target
  -- user's rows are touched; all triggers are re-enabled below (including in the
  -- exception path).
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces            DISABLE TRIGGER protect_default_workspace;
  ALTER TABLE public.workspaces            DISABLE TRIGGER tr_tombstone_workspace_slug_on_delete;
  ALTER TABLE public.organizations         DISABLE TRIGGER tr_tombstone_org_slug_on_delete;

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

  -- Re-enable all triggers before touching auth.users.
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;
  ALTER TABLE public.workspaces            ENABLE TRIGGER tr_tombstone_workspace_slug_on_delete;
  ALTER TABLE public.organizations         ENABLE TRIGGER tr_tombstone_org_slug_on_delete;

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
    -- Always re-enable triggers, even if the delete fails.
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

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
