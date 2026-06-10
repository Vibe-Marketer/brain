-- Migration: Backfill organization slugs
-- Purpose: Populate organizations.slug before enforcing NOT NULL and uniqueness
-- Date: 2026-06-09

-- ============================================================================
-- BACKFILL
-- ============================================================================

WITH base_slugs AS (
  SELECT
    id,
    created_at,
    COALESCE(
      NULLIF(LEFT(lower(regexp_replace(name, '[^a-z0-9]', '', 'gi')), 40), ''),
      'org'
    ) AS base_slug
  FROM public.organizations
  WHERE slug IS NULL
),
ranked AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY created_at ASC, id ASC) AS rn
  FROM base_slugs
)
UPDATE public.organizations AS org_row
SET slug = CASE
  WHEN ranked.rn = 1 THEN LEFT(ranked.base_slug, 40)
  ELSE LEFT(ranked.base_slug, GREATEST(1, 40 - length(ranked.rn::text))) || ranked.rn::text
END
FROM ranked
WHERE org_row.id = ranked.id;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE public.organizations
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique
  ON public.organizations(slug);

-- Register current slugs so deleted/recreated organizations cannot claim an
-- existing historical slug after this migration.
INSERT INTO public.org_slug_tombstone (slug)
SELECT slug
FROM public.organizations
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
