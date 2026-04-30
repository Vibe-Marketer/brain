-- Launch cleanup: 7-day Pro trial, MCP trial provisioning, and obsolete RAG/chat cleanup.

-- Keep SQL tier logic aligned with src/hooks/useSubscription.ts and Edge Functions.
CREATE OR REPLACE FUNCTION public.is_paid_tier(
  p_product_id TEXT,
  p_status     TEXT,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_product_id = 'pro-trial' THEN
    RETURN p_status = 'trialing' AND (p_period_end IS NULL OR p_period_end > now());
  END IF;

  IF p_product_id IN (
    '30020903-fa8f-4534-9cf1-6e9fba26584c',
    '9ff62255-446c-41fe-a84d-c04aed23725c',
    '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7',
    '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f'
  ) THEN
    RETURN p_status IN ('active', 'trialing');
  END IF;

  RETURN FALSE;
END;
$$;

-- New users get Free account fallback plus a 7-day Pro trial state.
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
  v_trial_end := NOW() + INTERVAL '7 days';

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

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO organizations (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_organization_id;

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, NEW.id, 'organization_owner');

  INSERT INTO workspaces (organization_id, name, workspace_type, is_default, is_home)
  VALUES (v_organization_id, 'My Calls', 'personal', TRUE, TRUE)
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'workspace_owner');

  PERFORM public.maybe_provision_mcp_token(v_organization_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates user profile with a 7-day Pro trial, FREE role fallback, personal organization, personal workspace, and trial MCP token.';

-- The original org INSERT trigger can miss signups because owner membership is inserted after organizations.
CREATE OR REPLACE FUNCTION public.provision_mcp_token_for_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'organization_owner' THEN
    PERFORM public.maybe_provision_mcp_token(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_provision_mcp_token_for_owner_membership ON public.organization_memberships;
CREATE TRIGGER tr_provision_mcp_token_for_owner_membership
  AFTER INSERT ON public.organization_memberships
  FOR EACH ROW
  WHEN (NEW.role = 'organization_owner')
  EXECUTE FUNCTION public.provision_mcp_token_for_owner_membership();

COMMENT ON TRIGGER tr_provision_mcp_token_for_owner_membership ON public.organization_memberships IS
  'Provisions the org MCP token once the owner membership exists, including signup trials.';

-- Obsolete chat/RAG/embedding queue objects are no longer used by the app or MCP server.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'hybrid_search_transcripts',
        'hybrid_search_transcripts_scoped',
        'claim_embedding_tasks',
        'increment_embedding_progress',
        'finalize_embedding_jobs'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.embedding_queue CASCADE;
DROP TABLE IF EXISTS public.chat_tool_calls CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE;

ALTER TABLE public.embedding_jobs
  DROP COLUMN IF EXISTS queue_total,
  DROP COLUMN IF EXISTS queue_completed,
  DROP COLUMN IF EXISTS queue_failed;

DO $$
BEGIN
  PERFORM cron.unschedule('embedding-worker-backup');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
  WHEN others THEN
    NULL;
END $$;
