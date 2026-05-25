-- Atomic connector disconnect.
--
-- All connector surfaces should call this RPC instead of sequencing client-side
-- import_sources/user_settings updates. This keeps legacy status fallbacks from
-- resurrecting a disconnected connector when a second update fails.

BEGIN;

CREATE OR REPLACE FUNCTION public.disconnect_connector_source(
  p_source_app text,
  p_source_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_remaining_active_sources integer := 0;
  v_source_touched boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_source_app IS NULL OR p_source_app !~ '^[a-z0-9][a-z0-9_-]*$' THEN
    RAISE EXCEPTION 'Invalid connector source app' USING ERRCODE = '22023';
  END IF;

  IF p_source_id IS NOT NULL THEN
    UPDATE public.import_sources
    SET
      is_active = false,
      error_message = NULL,
      updated_at = now()
    WHERE id = p_source_id
      AND user_id = v_user_id
      AND source_app = p_source_app;

    GET DIAGNOSTICS v_remaining_active_sources = ROW_COUNT;
    v_source_touched := v_remaining_active_sources > 0;

    IF NOT v_source_touched THEN
      RAISE EXCEPTION 'Connector source not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_source_app = 'fathom' THEN
    IF p_source_id IS NOT NULL THEN
      SELECT count(*)
      INTO v_remaining_active_sources
      FROM public.import_sources
      WHERE user_id = v_user_id
        AND source_app = 'fathom'
        AND is_active = true
        AND id <> p_source_id;
    END IF;

    IF p_source_id IS NULL OR v_remaining_active_sources = 0 THEN
      UPDATE public.user_settings
      SET
        fathom_api_key = NULL,
        webhook_secret = NULL,
        oauth_access_token = NULL,
        oauth_refresh_token = NULL,
        oauth_state = NULL,
        pending_import_source_id = NULL,
        oauth_token_expires = NULL,
        oauth_test_status = NULL,
        oauth_last_tested_at = NULL,
        webhook_test_status = NULL,
        webhook_last_tested_at = NULL
      WHERE user_id = v_user_id;
    END IF;
  ELSIF p_source_app = 'zoom' THEN
    UPDATE public.user_settings
    SET
      zoom_oauth_access_token = NULL,
      zoom_oauth_refresh_token = NULL,
      zoom_oauth_token_expires = NULL,
      zoom_oauth_state = NULL
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'disconnected', true,
    'sourceApp', p_source_app,
    'sourceId', p_source_id,
    'sourceTouched', v_source_touched
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disconnect_connector_source(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disconnect_connector_source(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.disconnect_connector_source(text, uuid) IS
  'Atomically deactivates a connector source and clears any legacy user_settings credentials that can report the connector as connected.';

COMMIT;
