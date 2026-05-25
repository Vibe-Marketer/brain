-- Revert connector-specific import defaults.
--
-- This preserves one fallback row per organization by keeping source_app = 'all'
-- when present, otherwise the most recently updated connector-specific row.

BEGIN;

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY organization_id
      ORDER BY
        CASE WHEN source_app = 'all' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        ctid DESC
    ) AS row_number
  FROM public.import_routing_defaults
)
DELETE FROM public.import_routing_defaults defaults
USING ranked
WHERE defaults.ctid = ranked.ctid
  AND ranked.row_number > 1;

ALTER TABLE public.import_routing_defaults
  DROP CONSTRAINT IF EXISTS import_routing_defaults_source_app_check;

ALTER TABLE public.import_routing_defaults
  DROP CONSTRAINT IF EXISTS import_routing_defaults_pkey;

ALTER TABLE public.import_routing_defaults
  ADD CONSTRAINT import_routing_defaults_pkey
  PRIMARY KEY (organization_id);

ALTER TABLE public.import_routing_defaults
  DROP COLUMN IF EXISTS source_app;

COMMIT;
