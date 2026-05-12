-- Migration: Backfill orphan fathom_raw_calls into recordings
-- Purpose: Insert missing `recordings` rows for the 91 fathom_raw_calls rows
--          that have no matching `recordings.legacy_recording_id`. Resolves the
--          last remaining surface of BUG-01 (Phase 30).
-- Author:  Claude (orchestrated by Andrew)
-- Date:    2026-05-11
-- Plan:    .planning/phases/30-uuid-legacy-id-root-cause-fix/30-04-PLAN.md
--
-- Idempotency: ON CONFLICT (organization_id, legacy_recording_id) DO NOTHING.
-- Safe to re-run; safe to apply after Phase 39 (Fathom mirror rebuild) which
-- might re-import these calls.

BEGIN;

-- Step 1: insert recordings rows for orphan fathom_raw_calls.
-- Resolve organization_id by picking the user's PRIMARY personal org —
-- the org where they have the most existing `source_app = 'fathom'`
-- recordings. See Plan 30-04 context for rationale.
WITH user_primary_org AS (
  SELECT owner_user_id, organization_id
  FROM (
    SELECT
      r.owner_user_id,
      r.organization_id,
      ROW_NUMBER() OVER (
        PARTITION BY r.owner_user_id
        ORDER BY count(*) DESC
      ) AS rn
    FROM recordings r
    WHERE r.source_app = 'fathom'
    GROUP BY r.owner_user_id, r.organization_id
  ) ranked
  WHERE rn = 1
),
orphans AS (
  SELECT f.*
  FROM fathom_raw_calls f
  LEFT JOIN recordings r ON r.legacy_recording_id = f.recording_id
  WHERE r.id IS NULL
)
INSERT INTO recordings (
  legacy_recording_id,
  organization_id,
  owner_user_id,
  title,
  audio_url,
  video_url,
  full_transcript,
  summary,
  global_tags,
  source_app,
  source_call_id,
  source_metadata,
  duration,
  recording_start_time,
  recording_end_time,
  created_at,
  synced_at
)
SELECT
  o.recording_id,
  upo.organization_id,
  o.user_id,
  COALESCE(NULLIF(TRIM(o.title), ''), 'Untitled Call'),
  o.url,
  o.share_url,
  o.full_transcript,
  o.summary,
  COALESCE(o.auto_tags, '{}'),
  COALESCE(o.source_platform, 'fathom'),
  o.recording_id::text,
  jsonb_build_object(
    'external_id', o.recording_id::text,
    'recorded_by_name', o.recorded_by_name,
    'recorded_by_email', o.recorded_by_email,
    'calendar_invitees', o.calendar_invitees,
    'meeting_fingerprint', o.meeting_fingerprint,
    'google_calendar_event_id', o.google_calendar_event_id,
    'google_drive_file_id', o.google_drive_file_id,
    'sentiment_cache', o.sentiment_cache,
    'original_metadata', o.metadata,
    'backfilled_by', 'phase-30-04',
    'backfilled_at', NOW()::text
  ),
  COALESCE(
    EXTRACT(EPOCH FROM (o.recording_end_time - o.recording_start_time))::INTEGER,
    0
  ),
  o.recording_start_time,
  o.recording_end_time,
  o.created_at,
  COALESCE(o.synced_at, NOW())
FROM orphans o
JOIN user_primary_org upo ON upo.owner_user_id = o.user_id
ON CONFLICT (organization_id, legacy_recording_id) DO NOTHING;

-- Step 2: link the new recordings back into fathom_raw_calls.canonical_recording_id
-- so existing query paths that join on that column also resolve cleanly.
UPDATE fathom_raw_calls f
SET canonical_recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = f.recording_id
  AND f.canonical_recording_id IS NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION (informational — run separately after migration completes)
-- ============================================================================
-- After this migration, the orphan count MUST be 0.
--
--   SELECT count(*) AS remaining_orphans
--   FROM fathom_raw_calls f
--   LEFT JOIN recordings r ON r.legacy_recording_id = f.recording_id
--   WHERE r.id IS NULL;
--
-- Expected: 0
--
-- Sanity check on which org the orphans landed in:
--
--   SELECT r.organization_id, count(*) AS new_rec_count
--   FROM recordings r
--   WHERE r.source_metadata->>'backfilled_by' = 'phase-30-04'
--   GROUP BY r.organization_id;
--
-- Expected: 43a2ae24-927a-4ba6-aa17-5d0a23e58008 = 4
--           04714fb3-d42c-42ad-801a-a8a49df6d06f = 87
