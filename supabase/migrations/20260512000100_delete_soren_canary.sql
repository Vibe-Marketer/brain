-- Migration: Delete Soren canary account (QA-19)
-- Purpose: Phase 31 requires soren@vibeos.com to be deleted from Supabase Auth
--          so signup happy-path can be re-tested cleanly. The account was created
--          on 2026-05-11 during Phase 29 QA sweep; it was auto-grandfathered by
--          the previous migration (20260512000000) which is incorrect for a
--          canary account. Explicit delete here.
--
--          The straightforward `DELETE FROM auth.users` is blocked by the
--          prevent_last_workspace_owner_removal user-defined trigger. To delete a
--          canary user we temporarily disable that specific trigger, delete the
--          workspaces, then delete the auth user (which cascades).
-- Author: Phase 31 (auth-signup-payment-gate)
-- Date: 2026-05-12

-- ============================================================================
-- DELETE: soren@vibeos.com workspaces, then auth row
-- ============================================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'soren@vibeos.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Soren canary not found; nothing to delete';
    RETURN;
  END IF;

  -- Temporarily disable the user-defined triggers blocking workspace deletion.
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces DISABLE TRIGGER protect_default_workspace;

  -- Delete the user's workspaces (cascades to workspace_memberships)
  DELETE FROM public.workspaces
    WHERE id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = v_user_id
    );

  -- Delete any remaining org memberships for this user
  DELETE FROM public.organization_memberships WHERE user_id = v_user_id;

  -- Delete organizations the user solely owned (cleanup)
  DELETE FROM public.organizations o
    WHERE o.type = 'personal'
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = o.id
      );

  -- Re-enable the triggers before touching auth.users
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;
  ALTER TABLE public.workspaces ENABLE TRIGGER protect_default_workspace;

  -- Finally delete the auth user (cascades to user_profiles, user_roles)
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'Soren canary deleted: %', v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
