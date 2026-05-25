-- Connector-specific import defaults.
--
-- Existing behavior remains available through source_app = 'all'. Connector
-- defaults use their source_app key (fathom, fireflies, zoom, plaud, etc.) and
-- are considered before the org-wide fallback by import routing.

BEGIN;

ALTER TABLE public.import_routing_defaults
  ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'all';

-- The old primary key was organization_id only. In case a partially-applied
-- branch/test migration already inserted duplicate connector rows, keep the
-- newest row for each organization/source_app before widening the key.
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY organization_id, source_app
      ORDER BY updated_at DESC NULLS LAST, ctid DESC
    ) AS row_number
  FROM public.import_routing_defaults
)
DELETE FROM public.import_routing_defaults defaults
USING ranked
WHERE defaults.ctid = ranked.ctid
  AND ranked.row_number > 1;

ALTER TABLE public.import_routing_defaults
  DROP CONSTRAINT IF EXISTS import_routing_defaults_pkey;

ALTER TABLE public.import_routing_defaults
  ADD CONSTRAINT import_routing_defaults_pkey
  PRIMARY KEY (organization_id, source_app);

ALTER TABLE public.import_routing_defaults
  ADD CONSTRAINT import_routing_defaults_source_app_check
  CHECK (source_app = 'all' OR source_app ~ '^[a-z0-9][a-z0-9_-]*$')
  NOT VALID;

ALTER TABLE public.import_routing_defaults
  VALIDATE CONSTRAINT import_routing_defaults_source_app_check;

COMMENT ON COLUMN public.import_routing_defaults.source_app IS
  'Connector key this default applies to. all means the organization-wide fallback.';

COMMIT;
