-- Migration: AI Credits System
-- Purpose: Track AI actions per user/org for usage limiting (Free/Pro/Team tiers)
-- Implements: Issue #156 - AI credits system and Polar.sh pricing tiers
-- Date: 2026-03-09

-- ============================================================================
-- TABLE: ai_usage
-- ============================================================================
-- Tracks each AI action consumed by a user. Used for monthly limit enforcement.
-- action_type maps to: smart_import, auto_name, auto_tag, chat_message
-- month_year (YYYY-MM) is denormalized for efficient monthly aggregation queries.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  action_type TEXT        NOT NULL,
  recording_id UUID       REFERENCES public.recordings(id) ON DELETE SET NULL,
  month_year  TEXT        NOT NULL, -- 'YYYY-MM' e.g. '2026-03'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_usage_action_type_check CHECK (
    action_type IN ('smart_import', 'auto_name', 'auto_tag', 'chat_message')
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month
  ON ai_usage(user_id, month_year);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_month
  ON ai_usage(org_id, month_year)
  WHERE org_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI usage"
  ON ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTION: get_monthly_ai_usage
-- ============================================================================
-- Returns the count of AI actions for a given user in a given month.
-- Called by the track-ai-usage edge function (which runs as service role).

CREATE OR REPLACE FUNCTION public.get_monthly_ai_usage(
  p_user_id   UUID,
  p_month_year TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM ai_usage
  WHERE user_id = p_user_id
    AND month_year = p_month_year;
$$;

-- ============================================================================
-- FUNCTION: get_monthly_org_ai_usage
-- ============================================================================
-- Returns the pooled count for a team org (Team tier: 5,000 shared actions).

CREATE OR REPLACE FUNCTION public.get_monthly_org_ai_usage(
  p_org_id     UUID,
  p_month_year TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM ai_usage
  WHERE org_id = p_org_id
    AND month_year = p_month_year;
$$;

-- ============================================================================
-- UPDATE SIGNUP TRIGGER: Add 14-day Pro trial for new users
-- ============================================================================
-- New users start with a 14-day Pro trial (product_id = 'pro-trial',
-- subscription_status = 'trialing', current_period_end = NOW() + 14 days).
-- When the trial ends, product_id reverts to NULL (Free tier).
-- This replaces the function defined in 20260301000001_rename_vaults_to_workspaces.sql.

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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates user profile (with 14-day Pro trial), FREE role, personal organization, and personal workspace on signup';

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE ai_usage IS 'Tracks AI actions per user/org for monthly limit enforcement';
COMMENT ON COLUMN ai_usage.action_type IS 'Type: smart_import | auto_name | auto_tag | chat_message';
COMMENT ON COLUMN ai_usage.month_year IS 'YYYY-MM format for efficient monthly aggregation';
COMMENT ON COLUMN ai_usage.org_id IS 'Set for team accounts to enable pooled org-level counting';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
