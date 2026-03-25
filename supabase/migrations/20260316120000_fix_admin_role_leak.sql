-- SECURITY FIX: Spurious ADMIN role on new user accounts
--
-- Root cause: A backfill migration on 2026-03-02 created user_roles rows for
-- all users in auth.users. A ghost/orphaned auth record (7942f09e) received an
-- ADMIN row. When andrew@aisimple.co signed up on 2026-03-16 and was assigned
-- that auth UUID, they inherited the ADMIN role. get_user_role() returns ADMIN
-- (highest precedence) even though the intended role is FREE.
--
-- Fix applied directly via psql on 2026-03-16:
--   DELETE FROM user_roles WHERE user_id='7942f09e...' AND role='ADMIN'
--
-- This migration adds a guard: when a new user_profile is inserted,
-- remove any pre-existing ADMIN rows for that user_id UNLESS they are in the
-- known admin list. This prevents future orphaned-auth-record attacks.
-- ============================================================================

-- ============================================================================
-- 1. Replace assign_free_role_to_new_user to also remove spurious higher roles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_free_role_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Skip the hardcoded admin account
  IF NEW.user_id = 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6' THEN
    RETURN NEW;
  END IF;

  -- Remove any pre-existing ADMIN or TEAM rows that may have been left by
  -- orphaned auth records or bad backfill migrations.
  DELETE FROM public.user_roles
  WHERE user_id = NEW.user_id
    AND role IN ('ADMIN', 'TEAM');

  -- Assign FREE role (no-op if already exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. Verify get_user_role is correct (defensive recreate)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'ADMIN' THEN 1
      WHEN 'TEAM' THEN 2
      WHEN 'PRO' THEN 3
      WHEN 'FREE' THEN 4
    END
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_user_role(UUID) IS
  'Get user''s highest role. SECURITY DEFINER — WHERE clause is critical to scope to requested user.';
