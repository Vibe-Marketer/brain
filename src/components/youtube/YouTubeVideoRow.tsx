/**
 * YouTubeVideoRow - Media-row list item for YouTube video display
 *
 * Renders a horizontal flex row with thumbnail, title/description,
 * channel name, stats, duration/published, category, and outlier rank.
 *
 * @pattern youtube-video-row
 * @brand-version v4.2
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { RiVideoLine } from '@remixicon/react'
import { YouTubeVideoStats } from '@/components/youtube/YouTubeVideoStats'
import { YouTubeOutlierBadge } from '@/components/youtube/YouTubeOutlierBadge'
import { getYouTubeMetadata } from '@/types/youtube'
import { parseYouTubeDuration, YOUTUBE_CATEGORIES } from '@/lib/youtube-utils'
import type { VaultRecording } from '@/hooks/useVaults'

export interface YouTubeVideoRowProps {
  /** Vault recording with YouTube source_metadata */
  recording: VaultRecording
  /** Click handler when user clicks title or thumbnail */
  onVideoClick: (recording: VaultRecording) => void
  /** Optional className override */
  className?: string
}

/**
 * Format a date string as relative time (e.g., "2 months ago", "1 year ago")
 */
function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '–'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffYears >= 1) return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`
  if (diffMonths >= 1) return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`
  if (diffDays >= 1) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  if (diffHr >= 1) return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`
  if (diffMin >= 1) return diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`
  return 'just now'
}

export function YouTubeVideoRow({ recording, onVideoClick, className }: YouTubeVideoRowProps) {
  const meta = useMemo(() => getYouTubeMetadata(recording.source_metadata), [recording.source_metadata])
  const duration = useMemo(
    () => meta?.youtube_duration ? parseYouTubeDuration(meta.youtube_duration) : null,
    [meta?.youtube_duration]
  )

  const thumbnailUrl = meta?.youtube_thumbnail
  const channelName = meta?.youtube_channel_title || '–'
  const description = meta?.youtube_description || ''
  const categoryName = meta?.youtube_category_id
    ? YOUTUBE_CATEGORIES[meta.youtube_category_id] || '–'
    : '–'
  const publishedDate = formatRelativeDate(recording.recording_start_time)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted/50 group',
        className
      )}
      role="row"
    >
      {/* 1. Thumbnail (120x68) */}
      <button
        type="button"
        onClick={() => onVideoClick(recording)}
        className="flex-shrink-0 w-[120px] h-[68px] rounded-md overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={`View ${recording.title}`}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <RiVideoLine className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
          </div>
        )}
      </button>

      {/* 2. Title + Description block */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onVideoClick(recording)}
          className="block w-full text-left focus:outline-none group/title"
        >
          <span className="block text-sm font-medium truncate group-hover/title:underline text-foreground">
            {recording.title}
          </span>
        </button>
        {description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {description}
          </p>
        )}
      </div>

      {/* 3. Channel column */}
      <div className="w-[140px] flex-shrink-0 hidden lg:block">
        <span className="text-xs text-muted-foreground truncate block" title={channelName}>
          {channelName}
        </span>
      </div>

      {/* 4. Stats column */}
      <div className="w-[120px] flex-shrink-0 hidden md:block">
        <YouTubeVideoStats
          views={meta?.youtube_view_count}
          likes={meta?.youtube_like_count}
          comments={meta?.youtube_comment_count}
          className="flex flex-col gap-0.5"
        />
      </div>

      {/* 5. Duration + Published column */}
      <div className="w-[100px] flex-shrink-0 hidden md:flex flex-col gap-0.5">
        <span className="text-xs text-foreground tabular-nums">
          {duration ? duration.display : '–'}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {publishedDate}
        </span>
      </div>

      {/* 6. Category column */}
      <div className="w-[90px] flex-shrink-0 hidden xl:block">
        <span className="text-xs text-muted-foreground truncate block" title={categoryName}>
          {categoryName}
        </span>
      </div>

      {/* 7. Outlier Rank column */}
      <div className="w-[80px] flex-shrink-0 hidden xl:flex justify-center">
        <YouTubeOutlierBadge />
      </div>
    </div>
  )
}
