-- Migration: Add CallVault destination workspace binding to import_sources
-- Purpose: Store the future landing workspace for connector imports without
--          moving historical recordings or workspace_entries.
-- Date: 2026-05-31

BEGIN;

ALTER TABLE public.import_sources
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.import_sources.workspace_id IS
  'CallVault destination workspace for future connector imports. This future landing workspace is distinct from provider-specific connection_metadata.workspace_id values and does not move existing recordings.';

-- The original table-level UNIQUE(user_id, source_app) and the later
-- single-account-active guard both prevent multiple connected accounts for the
-- same provider. Phase 05 keeps one future landing workspace per connector
-- instance while preserving multi-account provider behavior.
ALTER TABLE public.import_sources
  DROP CONSTRAINT IF EXISTS import_sources_user_id_source_app_key;

DROP INDEX IF EXISTS public.idx_import_sources_single_account_active;

-- Backfill legacy/unbound connector rows to the user's default/home workspace.
-- This intentionally updates only import_sources.workspace_id. It does not touch
-- recordings or workspace_entries; historical call placement remains user-owned.
WITH user_default_workspaces AS (
  SELECT DISTINCT ON (om.user_id)
    om.user_id,
    w.id AS workspace_id
  FROM public.organization_memberships om
  JOIN public.workspaces w
    ON w.organization_id = om.organization_id
  WHERE w.is_default = TRUE
  ORDER BY om.user_id, om.created_at ASC NULLS LAST, w.created_at ASC NULLS LAST
)
UPDATE public.import_sources sources
SET
  workspace_id = defaults.workspace_id,
  updated_at = now()
FROM user_default_workspaces defaults
WHERE sources.user_id = defaults.user_id
  AND sources.workspace_id IS NULL;

-- Defensive fallback for old tenants where a default flag was missing before
-- the home/default invariant was restored. Pick the oldest workspace in the
-- user's first org rather than dropping connector data.
WITH ranked_workspaces AS (
  SELECT
    om.user_id,
    w.id AS workspace_id,
    row_number() OVER (
      PARTITION BY om.user_id
      ORDER BY
        w.is_default DESC,
        w.is_home DESC,
        om.created_at ASC NULLS LAST,
        w.created_at ASC NULLS LAST
    ) AS row_number
  FROM public.organization_memberships om
  JOIN public.workspaces w
    ON w.organization_id = om.organization_id
)
UPDATE public.import_sources sources
SET
  workspace_id = ranked.workspace_id,
  updated_at = now()
FROM ranked_workspaces ranked
WHERE sources.user_id = ranked.user_id
  AND ranked.row_number = 1
  AND sources.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_import_sources_workspace_id
  ON public.import_sources (workspace_id);

CREATE INDEX IF NOT EXISTS idx_import_sources_user_workspace
  ON public.import_sources (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_import_sources_user_app_workspace
  ON public.import_sources (user_id, source_app, workspace_id);

-- Account-aware duplicate guard: same provider account can have one active row
-- per destination workspace, while different account identities remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_account_workspace_active
  ON public.import_sources (user_id, source_app, lower(account_email), workspace_id)
  WHERE is_active = TRUE
    AND account_email IS NOT NULL
    AND workspace_id IS NOT NULL;

-- Previous migrations used ON CONFLICT against idx_import_sources_single_account_active.
-- With multi-account rows now allowed, the Fireflies credential helper updates an
-- explicit source id when supplied and otherwise inserts a new connector instance.
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
    UPDATE public.import_sources
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
    INSERT INTO public.import_sources (
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

COMMENT ON FUNCTION store_encrypted_fireflies_credentials(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Stores encrypted Fireflies credentials on an explicit import_sources connector instance. Multiple provider accounts are supported; workspace binding lives on import_sources.workspace_id.';

COMMIT;
