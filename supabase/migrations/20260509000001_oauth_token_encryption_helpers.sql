-- Migration: OAuth token encryption helpers
-- Purpose: Add Postgres functions for encrypting/decrypting OAuth tokens at rest
--          using pgcrypto's pgp_sym_encrypt/pgp_sym_decrypt. Edge functions pass
--          the encryption key (from OAUTH_ENCRYPTION_KEY env var) at call time.
-- Author: Phase 28 Security Hardening
-- Date: 2026-05-09

-- ============================================================================
-- EXTENSION: pgcrypto (should already be enabled in Supabase, but ensure it)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- FUNCTION: encrypt_token — wraps pgp_sym_encrypt with armored text output
-- ============================================================================
-- Returns armored PGP text (storable in a TEXT column, no schema change needed).
-- The encryption key is passed as a parameter from the calling edge function.
CREATE OR REPLACE FUNCTION encrypt_token(plaintext TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT armor(pgp_sym_encrypt(plaintext, encryption_key))
$$;

COMMENT ON FUNCTION encrypt_token IS 'Encrypts a plaintext string using pgp_sym_encrypt with the provided key. Returns PGP-armored text.';

-- ============================================================================
-- FUNCTION: decrypt_token — wraps pgp_sym_decrypt with armored text input
-- ============================================================================
-- Accepts armored PGP text and returns the original plaintext.
-- Returns NULL if the input is NULL.
CREATE OR REPLACE FUNCTION decrypt_token(ciphertext TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE STRICT
AS $$
BEGIN
  -- Try to decrypt as PGP-armored ciphertext
  RETURN pgp_sym_decrypt(dearmor(ciphertext), encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails (e.g., value is still plaintext from before encryption
    -- was enabled), return the raw value as-is. This provides backward compatibility
    -- during the transition period.
    RETURN ciphertext;
END;
$$;

COMMENT ON FUNCTION decrypt_token IS 'Decrypts a PGP-armored ciphertext string. Falls back to returning the raw value if decryption fails (backward compat for plaintext values).';

-- ============================================================================
-- RPC: store_encrypted_oauth_tokens
-- ============================================================================
-- Stores encrypted OAuth tokens for an import_sources row.
-- Called from fathom-oauth-callback edge function.
CREATE OR REPLACE FUNCTION store_encrypted_oauth_tokens(
  p_source_id BIGINT,
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires BIGINT,
  p_encryption_key TEXT,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE import_sources
  SET
    oauth_access_token = encrypt_token(p_access_token, p_encryption_key),
    oauth_refresh_token = encrypt_token(p_refresh_token, p_encryption_key),
    oauth_token_expires = p_token_expires,
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_source_id
    AND user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION store_encrypted_oauth_tokens IS 'Stores encrypted OAuth tokens in import_sources. Called from fathom-oauth-callback.';

-- ============================================================================
-- RPC: store_encrypted_user_settings_tokens
-- ============================================================================
-- Stores encrypted OAuth tokens in user_settings (backward compatibility path).
CREATE OR REPLACE FUNCTION store_encrypted_user_settings_tokens(
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires BIGINT,
  p_encryption_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_settings
  SET
    oauth_access_token = encrypt_token(p_access_token, p_encryption_key),
    oauth_refresh_token = encrypt_token(p_refresh_token, p_encryption_key),
    oauth_token_expires = p_token_expires,
    oauth_state = NULL,
    pending_import_source_id = NULL
  WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION store_encrypted_user_settings_tokens IS 'Stores encrypted OAuth tokens in user_settings. Backward compat during import_sources migration.';

-- ============================================================================
-- RPC: get_decrypted_oauth_tokens
-- ============================================================================
-- Returns decrypted OAuth tokens for an import_sources row.
-- Falls back to plaintext if decryption fails (pre-encryption data).
CREATE OR REPLACE FUNCTION get_decrypted_oauth_tokens(
  p_source_id BIGINT,
  p_user_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE(access_token TEXT, refresh_token TEXT, token_expires BIGINT)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    decrypt_token(s.oauth_access_token, p_encryption_key) AS access_token,
    decrypt_token(s.oauth_refresh_token, p_encryption_key) AS refresh_token,
    s.oauth_token_expires AS token_expires
  FROM import_sources s
  WHERE s.id = p_source_id
    AND s.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_decrypted_oauth_tokens IS 'Returns decrypted OAuth tokens from import_sources. Falls back to plaintext for pre-encryption data.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
