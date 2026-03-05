/**
 * Raw call types — source-specific detail data from raw tables.
 * Used only in detail views; list views use the canonical Call/Recording type.
 */

export interface FathomRawCall {
  recording_id: number
  user_id: string
  canonical_recording_id?: string | null
  title: string
  created_at: string
  recording_start_time?: string | null
  recording_end_time?: string | null
  url?: string | null
  share_url?: string | null
  full_transcript?: string | null
  summary?: string | null
  recorded_by_name?: string | null
  recorded_by_email?: string | null
  calendar_invitees?: Array<{
    email: string
    name?: string
    matched_speaker_display_name?: string
  }> | null
  ai_generated_title?: string | null
  auto_tags?: string[] | null
  meeting_fingerprint?: string | null
  source_platform?: string | null
  is_primary?: boolean | null
  merged_from?: number[] | null
  fuzzy_match_score?: number | null
  synced_at?: string | null
}

export interface ZoomRawCall {
  id: string
  recording_id?: string | null
  user_id: string
  zoom_meeting_id?: string | null
  zoom_meeting_uuid?: string | null
  zoom_numeric_id?: string | null
  host_email?: string | null
  host_id?: string | null
  account_id?: string | null
  topic?: string | null
  start_time?: string | null
  duration?: number | null
  timezone?: string | null
  meeting_type?: number | null
  recording_url?: string | null
  share_url?: string | null
  transcript_url?: string | null
  full_transcript?: string | null
  participants?: unknown | null
  meeting_fingerprint?: string | null
  is_primary?: boolean | null
  merged_from?: number[] | null
  fuzzy_match_score?: number | null
  raw_payload?: unknown | null
  created_at: string
  synced_at?: string | null
}

export interface YouTubeRawCall {
  id: string
  recording_id?: string | null
  user_id: string
  youtube_video_id: string
  youtube_channel_id?: string | null
  youtube_channel_title?: string | null
  youtube_description?: string | null
  youtube_thumbnail?: string | null
  youtube_duration?: string | null
  youtube_category_id?: string | null
  youtube_published_at?: string | null
  youtube_view_count?: number | null
  youtube_like_count?: number | null
  youtube_comment_count?: number | null
  youtube_subscriber_count?: number | null
  import_source?: string | null
  full_transcript?: string | null
  raw_payload?: unknown | null
  created_at: string
}

export interface UploadRawFile {
  id: string
  recording_id?: string | null
  user_id: string
  original_filename: string
  file_size?: number | null
  mime_type?: string | null
  storage_path?: string | null
  whisper_model?: string | null
  transcription_language?: string | null
  full_transcript?: string | null
  raw_payload?: unknown | null
  created_at: string
}

/** Union type for any source-specific raw call data */
export type RawCallData = FathomRawCall | ZoomRawCall | YouTubeRawCall | UploadRawFile
