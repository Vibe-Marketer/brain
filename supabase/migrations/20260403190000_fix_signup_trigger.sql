-- Migration: Fix signup trigger (handle_new_user)
-- Root cause: Migration 20260301000001 ran DROP FUNCTION handle_new_user() CASCADE
-- which also dropped the auth.users trigger. Later migrations recreated the function
-- but never re-attached the trigger, so no new user gets a profile, org, or workspace.
-- Date: 2026-04-03

-- ============================================================================
-- STEP 1: Recreate handle_new_user() with the latest logic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id UUID;
  v_workspace_id    UUID;
  v_trial_end       TIMESTAMPTZ;
BEGIN
  v_trial_end := NOW() + INTERVAL '14 days';

  -- Insert profile with 14-day Pro trial
  INSERT INTO public.user_profiles (
    user_id,
    email,
    display_name,
    onboarding_completed,
    subscription_status,
    product_id,
    current_period_end
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false,
    'trialing',
    'pro-trial',
    v_trial_end
  );

  -- Assign default FREE role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create personal organization
  INSERT INTO organizations (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_organization_id;

  -- Create org membership as owner
  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, NEW.id, 'organization_owner');

  -- Create default personal workspace
  INSERT INTO workspaces (organization_id, name, workspace_type, is_default, is_home)
  VALUES (v_organization_id, 'My Calls', 'personal', TRUE, TRUE)
  RETURNING id INTO v_workspace_id;

  -- Create workspace membership as owner
  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'workspace_owner');

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 2: Re-attach the trigger to auth.users
-- ============================================================================
-- This is the line that was never re-created after the CASCADE drop.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 3: Backfill any users missing profiles (signed up while trigger was dead)
-- ============================================================================
-- Create user_profiles for any auth.users that don't have one
INSERT INTO user_profiles (user_id, email, display_name, onboarding_completed)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', u.email),
  false
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE up.user_id IS NULL;

-- Create user_roles for any users missing them
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'FREE'
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'FREE'
WHERE ur.user_id IS NULL;

-- Create personal organizations for users who don't have one
-- (users who have zero org memberships)
DO $$
DECLARE
  r RECORD;
  v_org_id UUID;
  v_ws_id UUID;
BEGIN
  FOR r IN
    SELECT u.id AS user_id
    FROM auth.users u
    LEFT JOIN organization_memberships om ON om.user_id = u.id
    WHERE om.user_id IS NULL
  LOOP
    -- Create personal org
    INSERT INTO organizations (name, type)
    VALUES ('Personal', 'personal')
    RETURNING id INTO v_org_id;

    -- Create org membership
    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (v_org_id, r.user_id, 'organization_owner');

    -- Create default workspace
    INSERT INTO workspaces (organization_id, name, workspace_type, is_default, is_home)
    VALUES (v_org_id, 'My Calls', 'personal', TRUE, TRUE)
    RETURNING id INTO v_ws_id;

    -- Create workspace membership
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_ws_id, r.user_id, 'workspace_owner');
  END LOOP;
END;
$$;
