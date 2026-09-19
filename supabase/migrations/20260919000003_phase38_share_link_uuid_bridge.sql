-- Migration: Bridge call share links from legacy BIGINT keys to recording UUIDs
-- Purpose: Preserve every existing share row/token/log while adding a UUID-native path
-- Date: 2026-09-19

-- Expand in place. The legacy key and its foreign key remain available throughout
-- Phase 38 so existing tokens and legacy callers continue to work unchanged.
ALTER TABLE public.call_share_links
  ADD COLUMN IF NOT EXISTS recording_id UUID
    REFERENCES public.recordings(id) ON DELETE CASCADE;

ALTER TABLE public.call_share_links
  ALTER COLUMN call_recording_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_share_links_recording_id
  ON public.call_share_links(recording_id)
  WHERE recording_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_share_links_recording_user_uuid
  ON public.call_share_links(recording_id, user_id)
  WHERE recording_id IS NOT NULL;

-- Backfill only owner-scoped legacy keys that resolve to exactly one canonical
-- recording. Unmapped or ambiguous rows retain their legacy key and are left
-- untouched for manual inventory/reconciliation.
WITH candidates AS (
  SELECT
    link.id AS share_link_id,
    recording.id AS recording_id,
    COUNT(*) OVER (PARTITION BY link.id) AS match_count
  FROM public.call_share_links AS link
  INNER JOIN public.recordings AS recording
    ON recording.fathom_provider_id = link.call_recording_id
   AND recording.owner_user_id = link.user_id
  WHERE link.recording_id IS NULL
    AND link.call_recording_id IS NOT NULL
),
unique_matches AS (
  SELECT share_link_id, recording_id
  FROM candidates
  WHERE match_count = 1
)
UPDATE public.call_share_links AS link
SET recording_id = unique_match.recording_id
FROM unique_matches AS unique_match
WHERE link.id = unique_match.share_link_id
  AND link.recording_id IS NULL;

-- New UUID-native rows may leave call_recording_id null, but no share row may
-- exist without either a canonical or legacy recording key. NOT VALID keeps the
-- locking window small; validation follows only after the deterministic backfill.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.call_share_links'::regclass
      AND conname = 'call_share_links_has_recording_key'
  ) THEN
    ALTER TABLE public.call_share_links
      ADD CONSTRAINT call_share_links_has_recording_key
      CHECK (
        recording_id IS NOT NULL
        OR call_recording_id IS NOT NULL
      ) NOT VALID;
  END IF;
END;
$migration$;

ALTER TABLE public.call_share_links
  VALIDATE CONSTRAINT call_share_links_has_recording_key;

COMMENT ON COLUMN public.call_share_links.recording_id IS
  'Canonical recording UUID. During the Phase 38 compatibility bridge, either recording_id or call_recording_id must be present.';

COMMENT ON COLUMN public.call_share_links.call_recording_id IS
  'Legacy provider recording key retained for compatibility. Nullable for UUID-native recordings.';

COMMENT ON TABLE public.call_share_access_log IS
  'Existing share-link access history is preserved unchanged during the Phase 38 UUID compatibility bridge.';

-- Service-role inventory helper. It reports bridge coverage without exposing
-- tokens, recipients, or other share-link data. match_count is always owner-scoped.
CREATE OR REPLACE FUNCTION public.get_call_share_link_uuid_bridge_inventory()
RETURNS TABLE (
  total_rows BIGINT,
  uuid_rows BIGINT,
  legacy_only_unique_rows BIGINT,
  unresolved_rows BIGINT,
  ambiguous_rows BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH inventory AS (
    SELECT
      link.recording_id,
      link.call_recording_id,
      (
        SELECT COUNT(*)
        FROM public.recordings AS recording
        WHERE recording.fathom_provider_id = link.call_recording_id
          AND recording.owner_user_id = link.user_id
      ) AS match_count
    FROM public.call_share_links AS link
  )
  SELECT
    COUNT(*)::BIGINT AS total_rows,
    COUNT(*) FILTER (WHERE recording_id IS NOT NULL)::BIGINT AS uuid_rows,
    COUNT(*) FILTER (
      WHERE recording_id IS NULL
        AND call_recording_id IS NOT NULL
        AND match_count = 1
    )::BIGINT AS legacy_only_unique_rows,
    COUNT(*) FILTER (
      WHERE recording_id IS NULL
        AND call_recording_id IS NOT NULL
        AND match_count = 0
    )::BIGINT AS unresolved_rows,
    COUNT(*) FILTER (
      WHERE recording_id IS NULL
        AND call_recording_id IS NOT NULL
        AND match_count > 1
    )::BIGINT AS ambiguous_rows
  FROM inventory;
$function$;

COMMENT ON FUNCTION public.get_call_share_link_uuid_bridge_inventory() IS
  'Read-only service-role inventory of UUID-backfilled, unresolved, and ambiguous call share links. Does not return tokens or recipient data.';

REVOKE EXECUTE ON FUNCTION public.get_call_share_link_uuid_bridge_inventory()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_call_share_link_uuid_bridge_inventory()
  TO service_role;

-- UUID-native Shared With Me surface. UUID rows are authoritative. Legacy-only
-- rows fall back only when the owner-scoped provider key has exactly one match;
-- an ambiguous key never selects an arbitrary recording.
CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me_v3(
  p_include_expired BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  recording_id UUID,
  call_name TEXT,
  recording_start_time TIMESTAMPTZ,
  duration TEXT,
  owner_user_id UUID,
  source_type TEXT,
  source_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH legacy_candidates AS (
    SELECT
      link.id AS share_link_id,
      recording.id AS recording_id,
      COUNT(*) OVER (PARTITION BY link.id) AS match_count
    FROM public.call_share_links AS link
    INNER JOIN public.recordings AS recording
      ON recording.fathom_provider_id = link.call_recording_id
     AND recording.owner_user_id = link.user_id
    WHERE link.recording_id IS NULL
      AND link.call_recording_id IS NOT NULL
  ),
  unique_legacy_matches AS (
    SELECT share_link_id, recording_id
    FROM legacy_candidates
    WHERE match_count = 1
  ),
  resolved_links AS (
    SELECT
      link.user_id,
      link.recipient_email,
      link.status,
      link.expires_at,
      COALESCE(link.recording_id, legacy.recording_id) AS canonical_recording_id
    FROM public.call_share_links AS link
    LEFT JOIN unique_legacy_matches AS legacy
      ON legacy.share_link_id = link.id
  )
  SELECT DISTINCT
    recording.id AS recording_id,
    recording.title AS call_name,
    recording.recording_start_time,
    NULL::TEXT AS duration,
    link.user_id AS owner_user_id,
    'share_link'::TEXT AS source_type,
    'Direct Link'::TEXT AS source_label
  FROM resolved_links AS link
  INNER JOIN public.recordings AS recording
    ON recording.id = link.canonical_recording_id
   AND recording.owner_user_id = link.user_id
  WHERE link.status = 'active'
    AND link.recipient_email IS NOT NULL
    AND lower(link.recipient_email) = lower((auth.jwt() ->> 'email'))
    AND (
      p_include_expired
      OR link.expires_at IS NULL
      OR link.expires_at > NOW()
    )
  ORDER BY recording.recording_start_time DESC;
$function$;

COMMENT ON FUNCTION public.get_calls_shared_with_me_v3(BOOLEAN) IS
  'Returns canonical recording UUIDs for active links shared with the authenticated user, with exact-one-match legacy fallback.';

REVOKE EXECUTE ON FUNCTION public.get_calls_shared_with_me_v3(BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me_v3(BOOLEAN)
  TO authenticated;

-- Preserve the existing BIGINT v2 signature for callers that have not migrated.
-- UUID-only recordings cannot be represented by that legacy return type, so the
-- wrapper returns only rows with a provider key while v3 returns every share.
CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me_v2(
  p_include_expired BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  recording_id BIGINT,
  call_name TEXT,
  recording_start_time TIMESTAMPTZ,
  duration TEXT,
  owner_user_id UUID,
  source_type TEXT,
  source_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    recording.fathom_provider_id AS recording_id,
    shared.call_name,
    shared.recording_start_time,
    shared.duration,
    shared.owner_user_id,
    shared.source_type,
    shared.source_label
  FROM public.get_calls_shared_with_me_v3(p_include_expired) AS shared
  INNER JOIN public.recordings AS recording
    ON recording.id = shared.recording_id
  WHERE recording.fathom_provider_id IS NOT NULL
  ORDER BY shared.recording_start_time DESC;
$function$;

COMMENT ON FUNCTION public.get_calls_shared_with_me_v2(BOOLEAN) IS
  'Legacy BIGINT compatibility wrapper over get_calls_shared_with_me_v3. New callers should use v3.';

REVOKE EXECUTE ON FUNCTION public.get_calls_shared_with_me_v2(BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me_v2(BOOLEAN)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
