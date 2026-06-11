-- Migration: Auto-generate organization and workspace slugs on INSERT
-- Purpose: Fix production signup 500 (ticket 3d1da686). Migrations
--          20260609000004/20260609000005 made organizations.slug and
--          workspaces.slug NOT NULL, but handle_new_user (and
--          ensure_personal_organization, accept_organization_invite,
--          ensure_home_workspace, create_business_organization,
--          migrate_fathom_call_to_recording, plus the frontend
--          organizations service) still INSERT without a slug. Every new
--          signup failed with 23502:
--            null value in column "slug" of relation "organizations"
--          Rather than patching all seven call sites, generate a unique,
--          tombstone-aware slug in BEFORE INSERT triggers. Trigger names
--          start with "tr_autogen" so they fire alphabetically BEFORE the
--          existing tr_check_combined_slug_length and
--          tr_reject_tombstoned_* validation triggers.
-- Date: 2026-06-11

-- ============================================================================
-- SLUG GENERATORS
-- ============================================================================

-- Globally-unique org slug. Base = slugified name; on collision with a live
-- slug or a tombstoned slug, append a random 7-char hex suffix. Final
-- fallback is a full UUID hex (32 chars), which satisfies ^[a-z0-9]+$ / 40.
CREATE OR REPLACE FUNCTION public.generate_org_slug(p_name TEXT)
RETURNS VARCHAR(40)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_base VARCHAR(40);
  v_slug VARCHAR(40);
BEGIN
  v_base := COALESCE(
    NULLIF(LEFT(lower(regexp_replace(COALESCE(p_name, ''), '[^a-z0-9]', '', 'gi')), 40), ''),
    'org'
  );
  v_slug := v_base;

  FOR i IN 1..20 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug)
       AND NOT EXISTS (SELECT 1 FROM public.org_slug_tombstone WHERE slug = v_slug)
    THEN
      RETURN v_slug;
    END IF;
    v_slug := LEFT(v_base, 33) || substr(md5(gen_random_uuid()::text), 1, 7);
  END LOOP;

  RETURN replace(gen_random_uuid()::text, '-', '');
END;
$$;

-- Per-org-unique workspace slug. Also caps length so the combined
-- "<org-slug>-<workspace-slug>" host label stays at or below 63 bytes
-- (mirrors check_combined_slug_length).
CREATE OR REPLACE FUNCTION public.generate_workspace_slug(p_organization_id UUID, p_name TEXT)
RETURNS VARCHAR(40)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_org_slug VARCHAR(40);
  v_max      INTEGER;
  v_base     VARCHAR(40);
  v_slug     VARCHAR(40);
BEGIN
  SELECT slug INTO v_org_slug
  FROM public.organizations
  WHERE id = p_organization_id;

  -- Org slug max is 40, so v_max is always >= 22; floor defensively at 8.
  v_max := LEAST(40, GREATEST(8, 63 - octet_length(COALESCE(v_org_slug, '')) - 1));

  v_base := COALESCE(
    NULLIF(LEFT(lower(regexp_replace(COALESCE(p_name, ''), '[^a-z0-9]', '', 'gi')), v_max), ''),
    'ws'
  );
  v_slug := v_base;

  FOR i IN 1..20 LOOP
    IF NOT EXISTS (
         SELECT 1 FROM public.workspaces
         WHERE organization_id = p_organization_id AND slug = v_slug
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.workspace_slug_tombstone
         WHERE org_id = p_organization_id AND slug = v_slug
       )
    THEN
      RETURN v_slug;
    END IF;
    v_slug := LEFT(v_base, GREATEST(1, v_max - 7)) || substr(md5(gen_random_uuid()::text), 1, 7);
  END LOOP;

  RETURN LEFT(replace(gen_random_uuid()::text, '-', ''), v_max);
END;
$$;

-- ============================================================================
-- AUTOGEN TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.autogen_org_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_org_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_autogen_org_slug ON public.organizations;
CREATE TRIGGER tr_autogen_org_slug
BEFORE INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.autogen_org_slug();

CREATE OR REPLACE FUNCTION public.autogen_workspace_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_workspace_slug(NEW.organization_id, NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_autogen_workspace_slug ON public.workspaces;
CREATE TRIGGER tr_autogen_workspace_slug
BEFORE INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.autogen_workspace_slug();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.generate_org_slug(TEXT) IS
  'Generates a globally-unique, tombstone-aware organization slug from a display name. Used by tr_autogen_org_slug.';

COMMENT ON FUNCTION public.generate_workspace_slug(UUID, TEXT) IS
  'Generates a per-org-unique, tombstone-aware workspace slug from a display name, capped so org-slug + "-" + slug stays <= 63 bytes. Used by tr_autogen_workspace_slug.';

COMMENT ON FUNCTION public.autogen_org_slug() IS
  'BEFORE INSERT trigger: fills organizations.slug when NULL (fix for signup 23502, ticket 3d1da686).';

COMMENT ON FUNCTION public.autogen_workspace_slug() IS
  'BEFORE INSERT trigger: fills workspaces.slug when NULL (fix for signup 23502, ticket 3d1da686).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
