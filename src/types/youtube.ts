/**
 * YouTube-specific type definitions for CallVault
 *
 * Provides typed interfaces for YouTube video metadata stored in
 * recordings.source_metadata JSONB, plus type-narrowing helpers.
 *
 * @pattern youtube-types
 * @brand-version v4.2
 */

/**
 * YouTubeVideoMetadata - Typed representation of YouTube-specific fields
 * stored in recordings.source_metadata JSONB
 *
 * Fields match the youtube-import Edge Function output stored in
 * fathom_calls.metadata and copied to recordings.source_metadata.
 */
export interface YouTubeVideoMetadata {
  /** YouTube video ID (e.g., "dQw4w9WgXcQ") */
  youtube_video_id: string
  /** YouTube channel ID */
  youtube_channel_id?: string
  /** YouTube channel display name */
  youtube_channel_title?: string
  /** Video description (may be truncated) */
  youtube_description?: string
  /** URL to high-res thumbnail (from i.ytimg.com) */
  youtube_thumbnail?: string
  /** Video duration in ISO 8601 format (e.g., "PT1H2M10S") — alias for youtube_duration_iso */
  youtube_duration?: string
  /** Video duration in ISO 8601 format (e.g., "PT1H2M10S") */
  youtube_duration_iso?: string
  /** Video definition: "hd" or "sd" */
  youtube_definition?: string
  /** ISO 8601 string of when the video was published on YouTube */
  youtube_published_at?: string
  /** Total view count */
  youtube_view_count?: number
  /** Total like count */
  youtube_like_count?: number
  /** Total comment count */
  youtube_comment_count?: number
  /** YouTube category ID (e.g., "22" for "People & Blogs") */
  youtube_category_id?: string
  /** Array of video tags from YouTube */
  youtube_tags?: string[]
  /** Channel subscriber count (null if hidden by channel owner) */
  youtube_subscriber_count?: number
  /** Total public video count on the channel */
  youtube_channel_video_count?: number
  /** Channel description (truncated) */
  youtube_channel_description?: string
  /** Import source identifier */
  import_source?: string
  /** ISO date string of when metadata was synced */
  synced_at?: string
  /** Whether YouTube Data API metadata fetch succeeded */
  youtube_metadata_fetch_success?: boolean
}

/**
 * Type-narrowing helper to extract typed YouTube metadata from source_metadata JSONB.
 *
 * Checks for the presence of `youtube_video_id` to determine if the metadata
 * contains YouTube-specific fields, then returns it as a typed interface.
 *
 * @param sourceMetadata - Raw source_metadata from a Recording
 * @returns Typed YouTubeVideoMetadata if YouTube fields are present, null otherwise
 *
 * @example
 * ```ts
 * const meta = getYouTubeMetadata(recording.source_metadata)
 * if (meta) {
 *   console.log(meta.youtube_video_id) // typed string
 *   console.log(meta.youtube_view_count) // typed number
 * }
 * ```
 */
export function getYouTubeMetadata(
  sourceMetadata: Record<string, unknown> | null | undefined
): YouTubeVideoMetadata | null {
  if (!sourceMetadata || !sourceMetadata.youtube_video_id) return null
  return sourceMetadata as unknown as YouTubeVideoMetadata
}
