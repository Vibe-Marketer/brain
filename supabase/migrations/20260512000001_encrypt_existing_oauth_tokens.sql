-- Migration: Encrypt existing plaintext OAuth tokens
-- Purpose: Convert plaintext OAuth tokens in import_sources and user_settings
--          to PGP-armored ciphertext using the encryption key from
--          OAUTH_ENCRYPTION_KEY Supabase secret (passed at call time).
--          IDEMPOTENT — re-running is safe (skips rows whose tokens look
--          already-armored, marked by the "-----BEGIN PGP MESSAGE-----" header).
-- Author: Phase 37 Security Hardening — Plan 37-04
-- Date: 2026-05-12

-- ============================================================================
-- FUNCTION: encrypt_existing_oauth_tokens(p_key TEXT)
-- ============================================================================
-- Encrypts plaintext OAuth tokens in-place. Skips rows already encrypted
-- (those whose value starts with the PGP armor header). Returns a JSON
-- summary with the affected row count per table so ops can verify migration
-- progress.
CREATE OR REPLACE FUNCTION encrypt_existing_oauth_tokens(p_key TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_import_sources_count INT := 0;
  v_user_settings_count  INT := 0;
BEGIN
  -- import_sources
  UPDATE import_sources
  SET
    oauth_access_token  = CASE
      WHEN oauth_access_token IS NOT NULL
       AND oauth_access_token NOT LIKE '-----BEGIN PGP MESSAGE-----%'
      THEN encrypt_token(oauth_access_token, p_key)
      ELSE oauth_access_token
    END,
    oauth_refresh_token = CASE
      WHEN oauth_refresh_token IS NOT NULL
       AND oauth_refresh_token NOT LIKE '-----BEGIN PGP MESSAGE-----%'
      THEN encrypt_token(oauth_refresh_token, p_key)
      ELSE oauth_refresh_token
    END
  WHERE
    (oauth_access_token  IS NOT NULL AND oauth_access_token  NOT LIKE '-----BEGIN PGP MESSAGE-----%')
    OR (oauth_refresh_token IS NOT NULL AND oauth_refresh_token NOT LIKE '-----BEGIN PGP MESSAGE-----%');

  GET DIAGNOSTICS v_import_sources_count = ROW_COUNT;

  -- user_settings
  UPDATE user_settings
  SET
    oauth_access_token  = CASE
      WHEN oauth_access_token IS NOT NULL
       AND oauth_access_token NOT LIKE '-----BEGIN PGP MESSAGE-----%'
      THEN encrypt_token(oauth_access_token, p_key)
      ELSE oauth_access_token
    END,
    oauth_refresh_token = CASE
      WHEN oauth_refresh_token IS NOT NULL
       AND oauth_refresh_token NOT LIKE '-----BEGIN PGP MESSAGE-----%'
      THEN encrypt_token(oauth_refresh_token, p_key)
      ELSE oauth_refresh_token
    END
  WHERE
    (oauth_access_token  IS NOT NULL AND oauth_access_token  NOT LIKE '-----BEGIN PGP MESSAGE-----%')
    OR (oauth_refresh_token IS NOT NULL AND oauth_refresh_token NOT LIKE '-----BEGIN PGP MESSAGE-----%');

  GET DIAGNOSTICS v_user_settings_count = ROW_COUNT;

  RETURN json_build_object(
    'import_sources_encrypted', v_import_sources_count,
    'user_settings_encrypted',  v_user_settings_count
  );
END;
$$;

COMMENT ON FUNCTION encrypt_existing_oauth_tokens IS
'One-shot encryption migration. Run manually after deploy with: SELECT encrypt_existing_oauth_tokens(''<OAUTH_ENCRYPTION_KEY_value>'');. Idempotent — re-running safely skips already-encrypted rows.';

-- ============================================================================
-- VIEW: oauth_token_encryption_status
-- ============================================================================
-- Ops visibility: counts plaintext vs encrypted tokens per table. Use this
-- to verify the baseline before running encrypt_existing_oauth_tokens(), and
-- to verify the result afterwards.
CREATE OR REPLACE VIEW oauth_token_encryption_status AS
SELECT
  'import_sources'::TEXT AS table_name,
  COUNT(*) FILTER (
    WHERE (oauth_access_token  IS NOT NULL AND oauth_access_token  NOT LIKE '-----BEGIN PGP MESSAGE-----%')
       OR (oauth_refresh_token IS NOT NULL AND oauth_refresh_token NOT LIKE '-----BEGIN PGP MESSAGE-----%')
  ) AS plaintext_rows,
  COUNT(*) FILTER (
    WHERE oauth_access_token LIKE '-----BEGIN PGP MESSAGE-----%'
       OR oauth_refresh_token LIKE '-----BEGIN PGP MESSAGE-----%'
  ) AS encrypted_rows,
  COUNT(*) AS total_rows
FROM import_sources
UNION ALL
SELECT
  'user_settings'::TEXT AS table_name,
  COUNT(*) FILTER (
    WHERE (oauth_access_token  IS NOT NULL AND oauth_access_token  NOT LIKE '-----BEGIN PGP MESSAGE-----%')
       OR (oauth_refresh_token IS NOT NULL AND oauth_refresh_token NOT LIKE '-----BEGIN PGP MESSAGE-----%')
  ) AS plaintext_rows,
  COUNT(*) FILTER (
    WHERE oauth_access_token LIKE '-----BEGIN PGP MESSAGE-----%'
       OR oauth_refresh_token LIKE '-----BEGIN PGP MESSAGE-----%'
  ) AS encrypted_rows,
  COUNT(*) AS total_rows
FROM user_settings;

COMMENT ON VIEW oauth_token_encryption_status IS
'Ops visibility into OAuth token encryption state. Used by Phase 37 SEC-09 verification. Query: SELECT * FROM oauth_token_encryption_status;';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
