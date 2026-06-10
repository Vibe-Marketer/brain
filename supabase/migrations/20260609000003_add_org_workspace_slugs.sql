-- Migration: Add organization and workspace slugs
-- Purpose: Enable stable MCP subdomain routing while preserving slug tombstones
-- Date: 2026-06-09
--
-- Adds nullable slug columns first so follow-up backfill migrations can populate
-- existing rows before enforcing NOT NULL and uniqueness.

-- ============================================================================
-- SLUG COLUMNS
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug VARCHAR(40) CHECK (slug ~ '^[a-z0-9]+$');

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS slug VARCHAR(40) CHECK (slug ~ '^[a-z0-9]+$');

-- ============================================================================
-- TOMBSTONE VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_tombstoned_org_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.slug IS DISTINCT FROM OLD.slug)
    AND EXISTS (
      SELECT 1
      FROM public.org_slug_tombstone tombstone
      WHERE tombstone.slug = NEW.slug
    )
  THEN
    RAISE EXCEPTION 'Organization slug has been retired: %', NEW.slug
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_reject_tombstoned_org_slug ON public.organizations;
CREATE TRIGGER tr_reject_tombstoned_org_slug
BEFORE INSERT OR UPDATE OF slug ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.reject_tombstoned_org_slug();

CREATE OR REPLACE FUNCTION public.reject_tombstoned_workspace_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.slug IS DISTINCT FROM OLD.slug)
    AND EXISTS (
      SELECT 1
      FROM public.workspace_slug_tombstone tombstone
      WHERE tombstone.org_id = NEW.organization_id
        AND tombstone.slug = NEW.slug
    )
  THEN
    RAISE EXCEPTION 'Workspace slug has been retired for this organization: %', NEW.slug
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_reject_tombstoned_workspace_slug ON public.workspaces;
CREATE TRIGGER tr_reject_tombstoned_workspace_slug
BEFORE INSERT OR UPDATE OF slug, organization_id ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.reject_tombstoned_workspace_slug();

-- ============================================================================
-- DELETE TOMBSTONE TRIGGERS
-- The 20260609000002 migration defines tombstone_org_slug() and
-- tombstone_workspace_slug(); the workspace function is corrected here to use
-- the live workspaces.organization_id column before triggers are created.
-- ============================================================================

DROP TRIGGER IF EXISTS tr_tombstone_org_slug_on_delete ON public.organizations;
CREATE TRIGGER tr_tombstone_org_slug_on_delete
AFTER DELETE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.tombstone_org_slug();

DROP TRIGGER IF EXISTS tr_tombstone_workspace_slug_on_delete ON public.workspaces;

CREATE OR REPLACE FUNCTION public.tombstone_workspace_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF OLD.slug IS NOT NULL THEN
    INSERT INTO public.workspace_slug_tombstone (org_id, slug)
    VALUES (OLD.organization_id, OLD.slug)
    ON CONFLICT (org_id, slug) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER tr_tombstone_workspace_slug_on_delete
AFTER DELETE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.tombstone_workspace_slug();

-- ============================================================================
-- COMBINED SUBDOMAIN LENGTH
-- PostgreSQL cannot use cross-table lookups in CHECK constraints, so this is a
-- trigger. Host labels must stay at or below 63 bytes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_combined_slug_length()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  org_slug VARCHAR(40);
BEGIN
  IF NEW.slug IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT slug
  INTO org_slug
  FROM public.organizations
  WHERE id = NEW.organization_id;

  IF org_slug IS NOT NULL AND octet_length(org_slug || '-' || NEW.slug) > 63 THEN
    RAISE EXCEPTION 'Combined subdomain too long: %-%', org_slug, NEW.slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_combined_slug_length ON public.workspaces;
CREATE TRIGGER tr_check_combined_slug_length
BEFORE INSERT OR UPDATE OF slug, organization_id ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.check_combined_slug_length();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.organizations.slug IS
  'URL-safe subdomain slug. ^[a-z0-9]+$, max 40 chars. Immutable after set; tombstoned on org delete.';

COMMENT ON COLUMN public.workspaces.slug IS
  'URL-safe subdomain slug. ^[a-z0-9]+$, max 40 chars. Unique per org. Tombstoned on workspace delete.';

COMMENT ON FUNCTION public.reject_tombstoned_org_slug() IS
  'Rejects assignment of an organization slug that already exists in org_slug_tombstone.';

COMMENT ON FUNCTION public.reject_tombstoned_workspace_slug() IS
  'Rejects assignment of a workspace slug that already exists in workspace_slug_tombstone for the same organization.';

COMMENT ON FUNCTION public.check_combined_slug_length() IS
  'Rejects workspace slugs whose org-slug + workspace-slug host label would exceed 63 bytes.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
