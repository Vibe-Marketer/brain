-- Migration: Fix OAuth encryption RPC type mismatch (UUID vs BIGINT)
-- Purpose:   Phase 28-03 / SEC-09 hotfix. The 2026-05-09 encryption helpers
--            declared p_source_id as BIGINT, but import_sources.id is UUID
--            (defined 2026-02-28). Every encrypted-path OAuth callback since
--            2026-05-09 has thrown Postgres error 22P02 ("invalid input
--            syntax for type bigint") before tokens could be stored, breaking
--            all new Fathom OAuth connects.
-- Evidence:  Direct RPC test 2026-05-22 returned
--              {"code":"22P02","message":"invalid input syntax for type
--               bigint: \"7927cb06-81e3-45e4-9fe5-93f365610d0d\""}
--            Last successful OAuth: 2026-04-17. 9 stuck oauth_state rows in
--            user_settings with no matching tokens since 2026-05-15.
-- Safety:    Idempotent. Drops old signatures, re-creates with UUID.
--            No data is read, written, or migrated. Existing plaintext tokens
--            in import_sources/user_settings are not touched. The refresh
--            path (which writes via direct UPDATE, not the RPC) is unaffected.
-- Date:      2026-05-22

-- ============================================================================
-- Drop the broken BIGINT signatures (the body is preserved below with UUID).
-- ============================================================================
DROP FUNCTION IF EXISTS store_encrypted_oauth_tokens(BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_decrypted_oauth_tokens(BIGINT, UUID, TEXT);

-- ============================================================================
-- RPC: store_encrypted_oauth_tokens — fixed signature (UUID, not BIGINT)
-- ============================================================================
CREATE OR REPLACE FUNCTION store_encrypted_oauth_tokens(
  p_source_id     UUID,
  p_user_id       UUID,
  p_access_token  TEXT,
  p_refresh_token TEXT,
  p_token_expires BIGINT,
  p_encryption_key TEXT,
  p_is_active     BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE import_sources
  SET
    oauth_access_token  = encrypt_token(p_access_token,  p_encryption_key),
    oauth_refresh_token = encrypt_token(p_refresh_token, p_encryption_key),
    oauth_token_expires = p_token_expires,
    is_active           = p_is_active,
    updated_at          = NOW()
  WHERE id      = p_source_id
    AND user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION store_encrypted_oauth_tokens IS
'Stores encrypted OAuth tokens in import_sources. Called from fathom-oauth-callback. p_source_id is UUID (fixed 2026-05-22 from BIGINT typo).';

-- ============================================================================
-- RPC: get_decrypted_oauth_tokens — fixed signature (UUID, not BIGINT)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_decrypted_oauth_tokens(
  p_source_id     UUID,
  p_user_id       UUID,
  p_encryption_key TEXT
)
RETURNS TABLE(access_token TEXT, refresh_token TEXT, token_expires BIGINT)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    decrypt_token(s.oauth_access_token,  p_encryption_key) AS access_token,
    decrypt_token(s.oauth_refresh_token, p_encryption_key) AS refresh_token,
    s.oauth_token_expires                                  AS token_expires
  FROM import_sources s
  WHERE s.id      = p_source_id
    AND s.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_decrypted_oauth_tokens IS
'Returns decrypted OAuth tokens from import_sources. Falls back to plaintext for pre-encryption data via decrypt_token EXCEPTION clause. p_source_id is UUID (fixed 2026-05-22 from BIGINT typo).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
