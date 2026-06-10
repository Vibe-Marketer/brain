-- Migration: Backfill workspace slugs
-- Purpose: Populate workspaces.slug before enforcing NOT NULL and per-org uniqueness
-- Date: 2026-06-09

-- ============================================================================
-- BACKFILL
-- ============================================================================

WITH base_slugs AS (
  SELECT
    id,
    organization_id,
    created_at,
    COALESCE(
      NULLIF(LEFT(lower(regexp_replace(name, '[^a-z0-9]', '', 'gi')), 40), ''),
      'workspace'
    ) AS base_slug
  FROM public.workspaces
  WHERE slug IS NULL
),
ranked AS (
  SELECT
    id,
    organization_id,
    base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, base_slug
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM base_slugs
)
UPDATE public.workspaces AS workspace_row
SET slug = CASE
  WHEN ranked.rn = 1 THEN LEFT(ranked.base_slug, 40)
  ELSE LEFT(ranked.base_slug, GREATEST(1, 40 - length(ranked.rn::text))) || ranked.rn::text
END
FROM ranked
WHERE workspace_row.id = ranked.id;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE public.workspaces
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_org_slug_unique
  ON public.workspaces(organization_id, slug);

-- Register current slugs so deleted/recreated workspaces cannot claim an
-- existing historical slug within the same organization after this migration.
INSERT INTO public.workspace_slug_tombstone (org_id, slug)
SELECT organization_id, slug
FROM public.workspaces
ON CONFLICT (org_id, slug) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
