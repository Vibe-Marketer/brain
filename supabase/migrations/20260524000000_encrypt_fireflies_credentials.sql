-- Migration: Encrypt Fireflies credentials at rest
-- Purpose: Encrypt `import_sources.api_key` and
--          `import_sources.webhook_signing_secret` for the Fireflies source
--          using the existing pgcrypto `encrypt_token` / `decrypt_token`
--          helpers from migration 20260509000001. Adds RPCs that the
--          fireflies-* edge functions use to read/write the encrypted values.
-- Author: Fireflies cleanup PR — 2026-05-24
--
-- Encryption key: passed in by each call as `p_encryption_key`. Edge functions
-- read it from the OAUTH_ENCRYPTION_KEY Supabase secret. The same key already
-- protects OAuth tokens; reusing it keeps key rotation a single operation.
--
-- Backward compatibility: `decrypt_token()` returns the raw value if its input
-- is not PGP-armored, so plaintext rows from before this migration continue
-- to read correctly until the one-shot encrypt_existing_fireflies_credentials()
-- backfill runs.

BEGIN;

-- ============================================================================
-- INDEX cleanup
-- ============================================================================
-- The unique index on plaintext `webhook_signing_secret` is meaningless once
-- the column is encrypted with pgp_sym_encrypt (each row encrypts to a
-- different ciphertext for the same plaintext because of the random IV). The
-- webhook_path_token unique index — added in the same prior migration — is
-- what actually scopes incoming webhooks now.
DROP INDEX IF EXISTS idx_import_sources_fireflies_webhook_secret_unique;

-- ============================================================================
-- RPC: get_decrypted_fireflies_source_for_user
-- ============================================================================
-- Returns the most-recently-updated active Fireflies source for a user with
-- credentials decrypted. Used by fireflies-fetch-meetings and
-- fireflies-sync-meetings.
CREATE OR REPLACE FUNCTION get_decrypted_fireflies_source_for_user(
  p_user_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE(
  id BIGINT,
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
'Returns the active Fireflies source for a user with api_key and webhook_signing_secret decrypted. Falls back to plaintext via decrypt_token() for pre-encryption rows.';

-- ============================================================================
-- RPC: get_decrypted_fireflies_source_by_path_token
-- ============================================================================
-- Look up the Fireflies source for an incoming webhook addressed by its
-- per-source path token. Returns credentials decrypted.
CREATE OR REPLACE FUNCTION get_decrypted_fireflies_source_by_path_token(
  p_path_token TEXT,
  p_encryption_key TEXT
)
RETURNS TABLE(
  id BIGINT,
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
'Resolves an active Fireflies source by webhook_path_token with credentials decrypted. Used by fireflies-webhook.';

-- ============================================================================
-- RPC: list_decrypted_active_fireflies_sources
-- ============================================================================
-- Returns every active Fireflies source whose webhook_signing_secret is set,
-- with credentials decrypted. Used by the legacy signature-scan fallback in
-- fireflies-webhook for senders that don't include a path token.
CREATE OR REPLACE FUNCTION list_decrypted_active_fireflies_sources(
  p_encryption_key TEXT
)
RETURNS TABLE(
  id BIGINT,
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
'Lists active Fireflies sources with credentials decrypted. Used by the legacy webhook signature-scan path; prefer the path-token resolver where possible.';

-- ============================================================================
-- RPC: store_encrypted_fireflies_credentials
-- ============================================================================
-- Upserts a Fireflies import_sources row with the api_key and
-- webhook_signing_secret encrypted at rest. Returns the row id. Called from
-- fireflies-save-source.
CREATE OR REPLACE FUNCTION store_encrypted_fireflies_credentials(
  p_source_id BIGINT,
  p_user_id UUID,
  p_account_email TEXT,
  p_api_key TEXT,
  p_webhook_signing_secret TEXT,
  p_webhook_path_token TEXT,
  p_encryption_key TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id BIGINT;
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
'Upserts a Fireflies import_sources row with api_key and webhook_signing_secret encrypted at rest via encrypt_token().';

-- ============================================================================
-- RPC: encrypt_existing_fireflies_credentials (one-shot backfill)
-- ============================================================================
-- Encrypts every plaintext Fireflies api_key and webhook_signing_secret
-- in-place. Idempotent — skips rows that look already-armored.
-- Run manually after deploy:
--   SELECT encrypt_existing_fireflies_credentials('<OAUTH_ENCRYPTION_KEY_value>');
CREATE OR REPLACE FUNCTION encrypt_existing_fireflies_credentials(p_key TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE import_sources
  SET
    api_key = CASE
      WHEN api_key IS NOT NULL
       AND api_key NOT LIKE '-----BEGIN PGP MESSAGE-----%'
      THEN encrypt_token(api_key, p_key)
      ELSE api_key
    END,
    webhook_signing_secret = CASE
      WHEN webhook_signing_secret IS NOT NULL
       AND webhook_signing_secret NOT LIKE '-----BEGIN PGP MESSAGE-----%'
      THEN encrypt_token(webhook_signing_secret, p_key)
      ELSE webhook_signing_secret
    END
  WHERE source_app = 'fireflies'
    AND (
      (api_key IS NOT NULL AND api_key NOT LIKE '-----BEGIN PGP MESSAGE-----%')
      OR
      (webhook_signing_secret IS NOT NULL
       AND webhook_signing_secret NOT LIKE '-----BEGIN PGP MESSAGE-----%')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('fireflies_rows_encrypted', v_count);
END;
$$;

COMMENT ON FUNCTION encrypt_existing_fireflies_credentials IS
'One-shot backfill — encrypts plaintext Fireflies api_key and webhook_signing_secret in-place. Idempotent. Run with the OAUTH_ENCRYPTION_KEY value after deploy.';

-- ============================================================================
-- VIEW: fireflies_credential_encryption_status (ops visibility)
-- ============================================================================
CREATE OR REPLACE VIEW fireflies_credential_encryption_status AS
SELECT
  COUNT(*) FILTER (
    WHERE (api_key IS NOT NULL AND api_key NOT LIKE '-----BEGIN PGP MESSAGE-----%')
       OR (webhook_signing_secret IS NOT NULL
           AND webhook_signing_secret NOT LIKE '-----BEGIN PGP MESSAGE-----%')
  ) AS plaintext_rows,
  COUNT(*) FILTER (
    WHERE api_key LIKE '-----BEGIN PGP MESSAGE-----%'
       OR webhook_signing_secret LIKE '-----BEGIN PGP MESSAGE-----%'
  ) AS encrypted_rows,
  COUNT(*) AS total_rows
FROM import_sources
WHERE source_app = 'fireflies';

COMMENT ON VIEW fireflies_credential_encryption_status IS
'Ops view: counts plaintext vs PGP-armored Fireflies credential rows. Query before and after running encrypt_existing_fireflies_credentials().';

COMMIT;
