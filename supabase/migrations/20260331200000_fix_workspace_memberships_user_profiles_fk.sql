-- Migration: Add FK from workspace_memberships to user_profiles
-- Problem: PostgREST returns HTTP 400 (PGRST200) when trying to embed
--          user_profiles in workspace_memberships queries:
--          "Could not find a relationship between 'workspace_memberships'
--           and 'user_profiles' in the schema cache"
--
--          workspace_memberships.user_id references auth.users(id) but NOT
--          user_profiles.user_id. PostgREST needs the FK to resolve the
--          embedded resource syntax: workspace_memberships?select=...user_profiles(...)
--
-- Fix: Add FK constraint from workspace_memberships.user_id → user_profiles.user_id
-- Date: 2026-03-31

-- ============================================================================
-- ADD FK: workspace_memberships.user_id → user_profiles.user_id
-- ============================================================================

ALTER TABLE public.workspace_memberships
  ADD CONSTRAINT fk_workspace_memberships_user_profiles
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_workspace_memberships_user_profiles ON public.workspace_memberships IS
  'Enables PostgREST embedded resource queries: workspace_memberships?select=...user_profiles(...)';

-- ============================================================================
-- Also add FK for organization_memberships → user_profiles (same pattern)
-- ============================================================================
-- organization_memberships also has user_id → auth.users but may need
-- embedded user_profiles queries. Add proactively to avoid the same PGRST200.

ALTER TABLE public.organization_memberships
  ADD CONSTRAINT fk_organization_memberships_user_profiles
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_organization_memberships_user_profiles ON public.organization_memberships IS
  'Enables PostgREST embedded resource queries: organization_memberships?select=...user_profiles(...)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
