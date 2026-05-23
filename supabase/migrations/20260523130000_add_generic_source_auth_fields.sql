BEGIN;

ALTER TABLE import_sources
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS webhook_signing_secret TEXT,
  ADD COLUMN IF NOT EXISTS webhook_path_token TEXT;

COMMENT ON COLUMN import_sources.api_key IS 'Generic API key for source connectors that authenticate with a static bearer token instead of OAuth.';
COMMENT ON COLUMN import_sources.webhook_signing_secret IS 'Generic signing secret used to verify incoming source webhooks for connectors like Fireflies.';
COMMENT ON COLUMN import_sources.webhook_path_token IS 'Opaque URL token used to route incoming source webhooks to a specific import_sources row before signature verification.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_fireflies_webhook_secret_unique
  ON import_sources (webhook_signing_secret)
  WHERE source_app = 'fireflies'
    AND webhook_signing_secret IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_webhook_path_token_unique
  ON import_sources (webhook_path_token)
  WHERE webhook_path_token IS NOT NULL;

COMMIT;
