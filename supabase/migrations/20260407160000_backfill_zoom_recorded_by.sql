-- Migration: Backfill recorded_by_email and recorded_by_name for existing Zoom recordings
-- Purpose: zoom-sync-meetings stored host email as zoom_host_email in source_metadata but not as
--          recorded_by_email / recorded_by_name — the keys that mapRecordingToMeeting and the
--          call_participants trigger read. This backfill copies the value across for all Zoom
--          recordings so the host appears on the right in the transcript view.
-- Date: 2026-04-07

-- ============================================================================
-- 1. Backfill recorded_by_email from zoom_host_email in source_metadata
-- ============================================================================
-- For Zoom recordings that have zoom_host_email but no recorded_by_email yet,
-- copy the value. We do NOT overwrite if already set (idempotent).

UPDATE recordings
SET source_metadata = source_metadata
  || jsonb_build_object(
       'recorded_by_email', source_metadata->>'zoom_host_email'
     )
WHERE source_app = 'zoom'
  AND source_metadata ? 'zoom_host_email'
  AND (source_metadata->>'zoom_host_email') IS NOT NULL
  AND (source_metadata->>'zoom_host_email') <> ''
  AND NOT (source_metadata ? 'recorded_by_email');

-- ============================================================================
-- 2. Backfill recorded_by_name from zoom_raw_calls where available
-- ============================================================================
-- zoom_raw_calls stores the host_email but not a display name. For the host name
-- we check if a call_participant row with type='host' already exists (it won't
-- for recordings created before this fix) and fall back to the email username.
-- Setting recorded_by_name to the email prefix gives the transcript view a
-- usable first-name match (e.g. "naegele412" → weak match, but better than null).
-- The real fix is to extract the name from the VTT transcript in zoom-sync-meetings,
-- which is now done for future syncs. For existing recordings we do a best-effort
-- patch using email prefix only if recorded_by_name is not already set.

UPDATE recordings
SET source_metadata = source_metadata
  || jsonb_build_object(
       'recorded_by_name',
       split_part(source_metadata->>'zoom_host_email', '@', 1)
     )
WHERE source_app = 'zoom'
  AND source_metadata ? 'zoom_host_email'
  AND (source_metadata->>'zoom_host_email') IS NOT NULL
  AND (source_metadata->>'zoom_host_email') <> ''
  AND NOT (source_metadata ? 'recorded_by_name');

-- ============================================================================
-- 3. Populate call_participants for Zoom recordings that now have recorded_by_email
-- ============================================================================
-- The populate_participants_from_source_metadata trigger only fires on INSERT.
-- For already-inserted recordings we manually insert the host participant row.

INSERT INTO call_participants (
  recording_id,
  organization_id,
  name,
  email,
  participant_type,
  sources
)
SELECT
  r.id,
  r.organization_id,
  r.source_metadata->>'recorded_by_name',
  lower(r.source_metadata->>'recorded_by_email'),
  'host',
  ARRAY['recorded_by']
FROM recordings r
WHERE r.source_app = 'zoom'
  AND r.source_metadata ? 'recorded_by_email'
  AND (r.source_metadata->>'recorded_by_email') IS NOT NULL
  AND (r.source_metadata->>'recorded_by_email') <> ''
ON CONFLICT (recording_id, email)
  WHERE email IS NOT NULL
DO UPDATE SET
  participant_type = CASE
    WHEN call_participants.participant_type = 'attendee' THEN 'host'
    ELSE call_participants.participant_type
  END,
  sources = ARRAY(SELECT DISTINCT unnest(call_participants.sources || ARRAY['recorded_by'])),
  name    = COALESCE(EXCLUDED.name, call_participants.name);

-- ============================================================================
-- 4. Sync participant_count for affected recordings
-- ============================================================================
UPDATE recordings r
SET participant_count = (
  SELECT COUNT(*) FROM call_participants cp WHERE cp.recording_id = r.id
)
WHERE r.source_app = 'zoom'
  AND EXISTS (
    SELECT 1 FROM call_participants cp WHERE cp.recording_id = r.id
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
