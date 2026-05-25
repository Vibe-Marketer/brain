-- Guard single-account native connectors from active duplicate rows.
--
-- Fathom remains multi-account. Fireflies, Plaud, and Zoom are single-account
-- in the current product model and should not have more than one active row per
-- user/source_app.

BEGIN;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, source_app
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.import_sources
  WHERE source_app IN ('fireflies', 'plaud', 'zoom', 'read-ai', 'grain')
    AND is_active = true
)
UPDATE public.import_sources sources
SET
  is_active = false,
  updated_at = now()
FROM ranked
WHERE sources.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_single_account_active
  ON public.import_sources (user_id, source_app)
  WHERE source_app IN ('fireflies', 'plaud', 'zoom', 'read-ai', 'grain')
    AND is_active = true;

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
      AND source_app = 'fireflies'
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
    ON CONFLICT (user_id, source_app)
      WHERE source_app IN ('fireflies', 'plaud', 'zoom', 'read-ai', 'grain')
        AND is_active = true
    DO UPDATE SET
      account_email = EXCLUDED.account_email,
      api_key = EXCLUDED.api_key,
      webhook_signing_secret = EXCLUDED.webhook_signing_secret,
      webhook_path_token = EXCLUDED.webhook_path_token,
      is_active = TRUE,
      error_message = NULL,
      updated_at = NOW()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMIT;
