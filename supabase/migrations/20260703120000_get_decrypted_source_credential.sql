-- Migration: generic per-source decrypted credential resolver for server-side sync-all
-- Purpose: The connector-sync-all pager (Phase 28) resolved credentials in a Fathom/OAuth-biased
--   way (oauth_access_token → fathom_api_key only). API-key providers (Fireflies, Plaud) store
--   their credential in the generic `api_key` column, so sync-all failed with
--   "No provider credentials for source ..." even though search/import worked (those use each
--   provider's own decrypt RPC). This function returns the first available DECRYPTED credential
--   for an import source — oauth_access_token, else api_key, else fathom_api_key — covering all
--   provider auth shapes with one call.
-- Author: v2.1 sync-all credential-resolution fix
-- Date: 2026-07-03

-- ============================================================================
-- FUNCTION: get_decrypted_source_credential
-- ============================================================================
CREATE OR REPLACE FUNCTION get_decrypted_source_credential(
  p_source_id UUID,
  p_user_id UUID,
  p_encryption_key TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(decrypt_token(s.oauth_access_token, p_encryption_key), ''),
    NULLIF(decrypt_token(s.api_key, p_encryption_key), ''),
    NULLIF(decrypt_token(s.fathom_api_key, p_encryption_key), '')
  )
  FROM import_sources s
  WHERE s.id = p_source_id
    AND s.user_id = p_user_id
  LIMIT 1;
$$;

-- Service-role only (the edge function runs as service_role and passes the job-owner's
-- user_id from the job row, never caller input — the pager's existing IDOR boundary).
REVOKE ALL ON FUNCTION get_decrypted_source_credential(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_decrypted_source_credential(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION get_decrypted_source_credential(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_source_credential(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION get_decrypted_source_credential IS
  'Server-side sync-all (Phase 28): returns the job-owner''s decrypted provider credential for an import source — COALESCE(oauth_access_token, api_key, fathom_api_key), each run through decrypt_token (plaintext-safe). Scoped by (source id, user id). SECURITY DEFINER, service_role only. Fixes non-Fathom api-key providers (Fireflies/Plaud) whose credential lives in the generic api_key column.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
