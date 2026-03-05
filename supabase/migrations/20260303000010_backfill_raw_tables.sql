-- Phase 5A: Backfill zoom_raw_calls from fathom_raw_calls WHERE source_platform='zoom'
-- Move Zoom data out of fathom_raw_calls into its own table.
INSERT INTO zoom_raw_calls (
  user_id,
  zoom_meeting_uuid,
  topic,
  start_time,
  full_transcript,
  meeting_fingerprint,
  is_primary,
  merged_from,
  fuzzy_match_score,
  created_at,
  synced_at
)
SELECT
  fc.user_id,
  -- Use meeting_fingerprint as zoom_meeting_uuid if no better identifier
  fc.meeting_fingerprint,
  fc.title,
  fc.recording_start_time,
  fc.full_transcript,
  fc.meeting_fingerprint,
  fc.is_primary,
  fc.merged_from,
  fc.fuzzy_match_score,
  fc.created_at,
  fc.synced_at
FROM fathom_raw_calls fc
WHERE fc.source_platform = 'zoom'
  -- Only insert if not already in zoom_raw_calls
  AND NOT EXISTS (
    SELECT 1 FROM zoom_raw_calls zrc
    WHERE zrc.user_id = fc.user_id
      AND zrc.zoom_meeting_uuid = fc.meeting_fingerprint
  );

-- Link zoom_raw_calls to canonical recordings via legacy_recording_id
UPDATE zoom_raw_calls zrc
SET recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = (
  SELECT fc.recording_id FROM fathom_raw_calls fc
  WHERE fc.user_id = zrc.user_id
    AND fc.meeting_fingerprint = zrc.zoom_meeting_uuid
    AND fc.source_platform = 'zoom'
  LIMIT 1
)
AND zrc.recording_id IS NULL;

-- Phase 5B: Backfill youtube_raw_calls from recordings WHERE source_app='youtube'
INSERT INTO youtube_raw_calls (
  recording_id,
  user_id,
  youtube_video_id,
  youtube_channel_id,
  youtube_channel_title,
  youtube_description,
  youtube_thumbnail,
  youtube_duration,
  youtube_view_count,
  youtube_like_count,
  youtube_comment_count,
  youtube_category_id,
  youtube_subscriber_count,
  youtube_published_at,
  import_source,
  full_transcript,
  created_at
)
SELECT
  r.id,
  r.owner_user_id,
  COALESCE(r.source_metadata->>'youtube_video_id', r.source_call_id, 'unknown'),
  r.source_metadata->>'youtube_channel_id',
  r.source_metadata->>'youtube_channel_title',
  r.source_metadata->>'youtube_description',
  r.source_metadata->>'youtube_thumbnail',
  r.source_metadata->>'youtube_duration',
  (r.source_metadata->>'youtube_view_count')::bigint,
  (r.source_metadata->>'youtube_like_count')::bigint,
  (r.source_metadata->>'youtube_comment_count')::bigint,
  r.source_metadata->>'youtube_category_id',
  (r.source_metadata->>'youtube_subscriber_count')::bigint,
  (r.source_metadata->>'youtube_published_at')::timestamptz,
  COALESCE(r.source_metadata->>'import_source', 'backfill'),
  r.full_transcript,
  r.created_at
FROM recordings r
WHERE r.source_app = 'youtube'
  AND r.source_metadata IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM youtube_raw_calls yrc WHERE yrc.recording_id = r.id
  );

-- Phase 5C: Backfill upload_raw_files from recordings WHERE source_app='file-upload'
INSERT INTO upload_raw_files (
  recording_id,
  user_id,
  original_filename,
  file_size,
  mime_type,
  storage_path,
  whisper_model,
  transcription_language,
  full_transcript,
  created_at
)
SELECT
  r.id,
  r.owner_user_id,
  COALESCE(r.source_metadata->>'original_filename', r.title, 'unknown'),
  (r.source_metadata->>'file_size')::bigint,
  r.source_metadata->>'mime_type',
  r.source_metadata->>'storage_path',
  COALESCE(r.source_metadata->>'whisper_model', 'whisper-1'),
  r.source_metadata->>'transcription_language',
  r.full_transcript,
  r.created_at
FROM recordings r
WHERE r.source_app = 'file-upload'
  AND NOT EXISTS (
    SELECT 1 FROM upload_raw_files urf WHERE urf.recording_id = r.id
  );

-- Phase 5D: Ensure canonical_recording_id is set on fathom_raw_calls
-- Link any fathom_raw_calls that don't yet have a canonical_recording_id
UPDATE fathom_raw_calls fc
SET canonical_recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = fc.recording_id
  AND fc.canonical_recording_id IS NULL;
