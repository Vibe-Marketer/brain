-- Migration: Multi-Fathom-Account Support
-- Purpose: Move OAuth tokens into import_sources so each connected account
--          is self-contained. Drop the UNIQUE(user_id, source_app) constraint
--          to allow multiple Fathom (or Zoom) accounts per user.
-- Date: 2026-04-03

BEGIN;

-- ============================================================================
-- STEP 1: Add credential columns to import_sources
-- ============================================================================
ALTER TABLE import_sources ADD COLUMN IF NOT EXISTS oauth_access_token TEXT;
ALTER TABLE import_sources ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;
ALTER TABLE import_sources ADD COLUMN IF NOT EXISTS oauth_token_expires BIGINT;
ALTER TABLE import_sources ADD COLUMN IF NOT EXISTS fathom_api_key TEXT;

-- ============================================================================
-- STEP 2: Add pending_import_source_id to user_settings for OAuth flow tracking
-- ============================================================================
-- During OAuth, we create an import_sources row first, then store its ID here
-- so the callback knows which row to write tokens into.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pending_import_source_id UUID;

-- ============================================================================
-- STEP 3: Migrate existing Fathom tokens from user_settings → import_sources
-- ============================================================================
-- Copy tokens to the matching import_sources row so existing accounts keep working.
UPDATE import_sources ims
SET
  oauth_access_token = us.oauth_access_token,
  oauth_refresh_token = us.oauth_refresh_token,
  oauth_token_expires = us.oauth_token_expires,
  fathom_api_key = us.fathom_api_key
FROM user_settings us
WHERE ims.user_id = us.user_id
  AND ims.source_app = 'fathom'
  AND (us.oauth_access_token IS NOT NULL OR us.fathom_api_key IS NOT NULL);

-- ============================================================================
-- STEP 4: Drop the unique constraint that prevents multiple accounts per source
-- ============================================================================
-- The constraint name comes from the CREATE TABLE in 20260228000002.
ALTER TABLE import_sources DROP CONSTRAINT IF EXISTS import_sources_user_id_source_app_key;

-- ============================================================================
-- STEP 5: Add account_email to existing Fathom rows where we can detect it
-- ============================================================================
-- For users with host_email set, populate the import_sources.account_email
-- so the UI can display which Fathom account is connected.
UPDATE import_sources ims
SET account_email = us.host_email
FROM user_settings us
WHERE ims.user_id = us.user_id
  AND ims.source_app = 'fathom'
  AND ims.account_email IS NULL
  AND us.host_email IS NOT NULL
  AND us.host_email != '';

-- ============================================================================
-- STEP 6: No new RLS policies needed
-- ============================================================================
-- import_sources already has user-scoped RLS policies covering all columns.
-- The new credential columns are automatically protected.

COMMIT;
