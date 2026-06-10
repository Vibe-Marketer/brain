-- Migration: Slug tombstone tables for org and workspace slugs
-- Purpose: Prevent re-registration of deleted org/workspace slugs
-- Date: 2026-06-09
--
-- Security: T-06.1-SLUG-01 / T-06.1-SLUG-02 (ISC-20–26)
-- A deleted org's slug must never be re-registered by a new org — otherwise old MCP
-- integrations pointing at acmecorp.callvaultai.com/mcp would route to a different
-- org's data. Tombstone tables permanently record all retired slugs.
--
-- NOTE: The trigger FUNCTIONS are defined here, but the CREATE TRIGGER statements
-- are intentionally deferred to the slug-schema migration (Wave 3). The organizations.slug
-- and workspaces.slug columns do not exist yet; attempting to reference OLD.slug before
-- ADD COLUMN would cause Postgres to error at trigger-creation time.

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.org_slug_tombstone (
  slug       VARCHAR(40) PRIMARY KEY,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_slug_tombstone (
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug       VARCHAR(40) NOT NULL,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, slug)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Service-role only. No user-facing RLS policies needed — tombstone tables are
-- internal integrity tables, never exposed via user JWTs.
-- ============================================================================

ALTER TABLE public.org_slug_tombstone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_slug_tombstone ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- These are defined now so the slug-schema migration (Wave 3) can reference them
-- when it runs CREATE TRIGGER after ADD COLUMN slug.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tombstone_org_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF OLD.slug IS NOT NULL THEN
    INSERT INTO public.org_slug_tombstone (slug)
    VALUES (OLD.slug)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.tombstone_workspace_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF OLD.slug IS NOT NULL THEN
    INSERT INTO public.workspace_slug_tombstone (org_id, slug)
    VALUES (OLD.org_id, OLD.slug)
    ON CONFLICT (org_id, slug) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.org_slug_tombstone IS
  'Permanently retired org slugs; prevents re-registration after org deletion';

COMMENT ON TABLE public.workspace_slug_tombstone IS
  'Permanently retired workspace slugs within an org; prevents re-registration';

COMMENT ON FUNCTION public.tombstone_org_slug() IS
  'Records deleted org slug into org_slug_tombstone to prevent re-registration. Used by tr_tombstone_org_slug trigger (created in slug-schema migration after organizations.slug ADD COLUMN).';

COMMENT ON FUNCTION public.tombstone_workspace_slug() IS
  'Records deleted workspace slug into workspace_slug_tombstone to prevent re-registration. Used by tr_tombstone_workspace_slug trigger (created in slug-schema migration after workspaces.slug ADD COLUMN).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
