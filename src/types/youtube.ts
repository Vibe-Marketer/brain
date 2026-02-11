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
  youtube_channel_id: string
  /** YouTube channel display name */
  youtube_channel_title: string
  /** Video description (may be truncated) */
  youtube_description: string
  /** URL to high-res thumbnail (from i.ytimg.com) */
  youtube_thumbnail: string
  /** Video duration in ISO 8601 format (e.g., "PT1H2M10S") */
  youtube_duration: string
  /** Total view count */
  youtube_view_count: number
  /** Total like count */
  youtube_like_count: number
  /** Total comment count (not always available) */
  youtube_comment_count?: number
  /** YouTube category ID (e.g., "22" for "People & Blogs") */
  youtube_category_id?: string
  /** Channel subscriber count (not always available) */
  youtube_subscriber_count?: number
  /** Import source identifier */
  import_source: string
  /** ISO date string of when the video was imported */
  imported_at: string
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
