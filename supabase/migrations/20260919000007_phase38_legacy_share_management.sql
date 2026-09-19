-- Phase 38 owner management for surviving legacy-only share links.
-- Additive follow-up to the already-applied 20260919000001..000006 migrations.

CREATE OR REPLACE FUNCTION public.list_owner_share_links_v2(
  p_recording_id UUID
)
RETURNS TABLE (
  id UUID,
  recording_id UUID,
  call_recording_id BIGINT,
  user_id UUID,
  created_by_user_id UUID,
  share_token TEXT,
  recipient_email TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  resolved_recording_id UUID,
  resolution_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH owned_links AS (
    SELECT link.*
    FROM public.call_share_links AS link
    WHERE auth.uid() IS NOT NULL
      AND link.user_id = auth.uid()
  ),
  bridge_resolution AS (
    SELECT
      link.*,
      candidate.match_count,
      candidate.recording_id AS unique_recording_id
    FROM owned_links AS link
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::INTEGER AS match_count,
        CASE
          WHEN COUNT(*) = 1 THEN (array_agg(recording.id ORDER BY recording.id))[1]
        END AS recording_id
      FROM public.recordings AS recording
      WHERE link.recording_id IS NULL
        AND link.call_recording_id IS NOT NULL
        AND recording.owner_user_id = link.user_id
        AND recording.fathom_provider_id = link.call_recording_id
    ) AS candidate ON TRUE
  ),
  classified AS (
    SELECT
      bridge.*,
      CASE
        WHEN bridge.recording_id IS NOT NULL THEN bridge.recording_id
        WHEN bridge.match_count = 1 THEN bridge.unique_recording_id
        ELSE NULL
      END AS managed_recording_id,
      CASE
        WHEN bridge.recording_id IS NOT NULL THEN 'canonical'
        WHEN bridge.match_count = 1 THEN 'legacy_unique'
        WHEN COALESCE(bridge.match_count, 0) = 0 THEN 'legacy_unresolved'
        ELSE 'legacy_ambiguous'
      END AS bridge_status
    FROM bridge_resolution AS bridge
  )
  SELECT
    classified.id,
    classified.recording_id,
    classified.call_recording_id,
    classified.user_id,
    classified.created_by_user_id,
    classified.share_token,
    classified.recipient_email,
    classified.status,
    classified.created_at,
    classified.revoked_at,
    classified.expires_at,
    classified.managed_recording_id,
    classified.bridge_status
  FROM classified
  WHERE classified.managed_recording_id = p_recording_id
     OR classified.bridge_status IN ('legacy_unresolved', 'legacy_ambiguous')
  ORDER BY
    CASE
      WHEN classified.managed_recording_id = p_recording_id THEN 0
      ELSE 1
    END,
    classified.created_at DESC,
    classified.id DESC
$function$;

COMMENT ON FUNCTION public.list_owner_share_links_v2(UUID) IS
  'Lists an authenticated owner''s links for one canonical recording, resolving legacy keys only on an exact owner-scoped match. Unresolved and ambiguous legacy-only rows remain unattached and are returned through a separate resolution status so the owner can revoke them safely.';

REVOKE EXECUTE ON FUNCTION public.list_owner_share_links_v2(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_owner_share_links_v2(UUID)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
