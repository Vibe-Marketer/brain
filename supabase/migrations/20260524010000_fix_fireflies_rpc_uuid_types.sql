-- Migration: Fix Fireflies RPC type signatures (UUID, not BIGINT)
-- Purpose:   Hotfix for #278 (Fireflies cleanup). All four Fireflies RPCs in
--            20260524000000 were declared with `BIGINT` for the id column,
--            but `import_sources.id` is UUID (defined 2026-02-28). Every
--            Fireflies read or write call returns:
--
--              42804: Returned type uuid does not match expected type bigint
--                     in column 1. structure of query does not match function
--                     result type.
--
--            This is the SAME class of bug that broke Fathom OAuth for two
--            weeks (see 20260522180000_fix_oauth_rpc_uuid_types.sql). Both
--            shipped with security hardening that wasn't end-to-end tested
--            against the real schema. Recurrent pattern; addressed by
--            dropping and recreating with the correct type.
--
-- Scope:     Four functions in the Fireflies pipeline:
--              1. get_decrypted_fireflies_source_for_user
--              2. get_decrypted_fireflies_source_by_path_token
--              3. list_decrypted_active_fireflies_sources
--              4. store_encrypted_fireflies_credentials
--
-- Safety:    DDL only. No data is read, written, or migrated. Existing
--            plaintext credential rows in import_sources stay untouched.
--            The backfill (`encrypt_existing_fireflies_credentials`) does
--            not have this bug and is unchanged.
-- Date:      2026-05-23

BEGIN;

DROP FUNCTION IF EXISTS get_decrypted_fireflies_source_for_user(UUID, TEXT);
DROP FUNCTION IF EXISTS get_decrypted_fireflies_source_by_path_token(TEXT, TEXT);
DROP FUNCTION IF EXISTS list_decrypted_active_fireflies_sources(TEXT);
DROP FUNCTION IF EXISTS store_encrypted_fireflies_credentials(BIGINT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

-- ============================================================================
-- 1. get_decrypted_fireflies_source_for_user — id is UUID
-- ============================================================================
CREATE OR REPLACE FUNCTION get_decrypted_fireflies_source_for_user(
  p_user_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  api_key TEXT,
  webhook_signing_secret TEXT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    decrypt_token(s.api_key, p_encryption_key) AS api_key,
    decrypt_token(s.webhook_signing_secret, p_encryption_key) AS webhook_signing_secret
  FROM import_sources s
  WHERE s.user_id = p_user_id
    AND s.source_app = 'fireflies'
    AND s.is_active = TRUE
  ORDER BY s.updated_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_decrypted_fireflies_source_for_user IS
'Returns the active Fireflies source for a user with credentials decrypted. id is UUID (fixed 2026-05-23 from BIGINT typo).';

-- ============================================================================
-- 2. get_decrypted_fireflies_source_by_path_token — id is UUID
-- ============================================================================
CREATE OR REPLACE FUNCTION get_decrypted_fireflies_source_by_path_token(
  p_path_token TEXT,
  p_encryption_key TEXT
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  api_key TEXT,
  webhook_signing_secret TEXT,
  webhook_path_token TEXT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    decrypt_token(s.api_key, p_encryption_key) AS api_key,
    decrypt_token(s.webhook_signing_secret, p_encryption_key) AS webhook_signing_secret,
    s.webhook_path_token
  FROM import_sources s
  WHERE s.source_app = 'fireflies'
    AND s.is_active = TRUE
    AND s.webhook_path_token = p_path_token
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_decrypted_fireflies_source_by_path_token IS
'Resolves an active Fireflies source by webhook_path_token with credentials decrypted. id is UUID (fixed 2026-05-23 from BIGINT typo).';

-- ============================================================================
-- 3. list_decrypted_active_fireflies_sources — id is UUID
-- ============================================================================
CREATE OR REPLACE FUNCTION list_decrypted_active_fireflies_sources(
  p_encryption_key TEXT
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  api_key TEXT,
  webhook_signing_secret TEXT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    decrypt_token(s.api_key, p_encryption_key) AS api_key,
    decrypt_token(s.webhook_signing_secret, p_encryption_key) AS webhook_signing_secret
  FROM import_sources s
  WHERE s.source_app = 'fireflies'
    AND s.is_active = TRUE
    AND s.webhook_signing_secret IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION list_decrypted_active_fireflies_sources IS
'Lists active Fireflies sources with credentials decrypted. id is UUID (fixed 2026-05-23 from BIGINT typo).';

-- ============================================================================
-- 4. store_encrypted_fireflies_credentials — p_source_id, RETURNS, v_id all UUID
-- ============================================================================
CREATE OR REPLACE FUNCTION store_encrypted_fireflies_credentials(
  p_source_id UUID,
  p_user_id UUID,
  p_account_email TEXT,
  p_api_key TEXT,
  p_webhook_signing_secret TEXT,
  p_webhook_path_token TEXT,
  p_encryption_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_source_id IS NOT NULL THEN
    UPDATE import_sources
    SET
      account_email = p_account_email,
      api_key = encrypt_token(p_api_key, p_encryption_key),
      webhook_signing_secret = encrypt_token(p_webhook_signing_secret, p_encryption_key),
      webhook_path_token = p_webhook_path_token,
      is_active = TRUE,
      error_message = NULL,
      updated_at = NOW()
    WHERE id = p_source_id
      AND user_id = p_user_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Fireflies source % not found for user %', p_source_id, p_user_id
        USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
    INSERT INTO import_sources (
      user_id,
      source_app,
      account_email,
      api_key,
      webhook_signing_secret,
      webhook_path_token,
      is_active,
      error_message,
      updated_at
    )
    VALUES (
      p_user_id,
      'fireflies',
      p_account_email,
      encrypt_token(p_api_key, p_encryption_key),
      encrypt_token(p_webhook_signing_secret, p_encryption_key),
      p_webhook_path_token,
      TRUE,
      NULL,
      NOW()
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION store_encrypted_fireflies_credentials IS
'Upserts a Fireflies import_sources row with credentials encrypted at rest. p_source_id, return type, and v_id are UUID (fixed 2026-05-23 from BIGINT typo).';

COMMIT;
