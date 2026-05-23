BEGIN;

ALTER TABLE import_sources
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS webhook_signing_secret TEXT;

COMMENT ON COLUMN import_sources.api_key IS 'Generic API key for source connectors that authenticate with a static bearer token instead of OAuth.';
COMMENT ON COLUMN import_sources.webhook_signing_secret IS 'Generic signing secret used to verify incoming source webhooks for connectors like Fireflies.';

COMMIT;
