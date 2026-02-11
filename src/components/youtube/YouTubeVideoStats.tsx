/**
 * YouTubeVideoStats - Inline stats display for YouTube video metadata
 *
 * Shows views, likes, and comments counts in a compact horizontal layout
 * using Remix icons and formatCompactNumber for display.
 *
 * @pattern youtube-video-stats
 * @brand-version v4.2
 */

import { RiEyeLine, RiThumbUpLine, RiChat3Line } from '@remixicon/react'
import { formatCompactNumber } from '@/lib/youtube-utils'

export interface YouTubeVideoStatsProps {
  /** Total view count */
  views?: number | null
  /** Total like count */
  likes?: number | null
  /** Total comment count */
  comments?: number | null
  /** Optional className override */
  className?: string
}

export function YouTubeVideoStats({ views, likes, comments, className }: YouTubeVideoStatsProps) {
  return (
    <div className={className}>
      {/* Views */}
      <div className="flex items-center gap-0.5" title={views != null ? `${views.toLocaleString()} views` : 'No view data'}>
        <RiEyeLine className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {views != null ? formatCompactNumber(views) : '–'}
        </span>
      </div>

      {/* Likes */}
      <div className="flex items-center gap-0.5" title={likes != null ? `${likes.toLocaleString()} likes` : 'No like data'}>
        <RiThumbUpLine className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {likes != null ? formatCompactNumber(likes) : '–'}
        </span>
      </div>

      {/* Comments */}
      <div className="flex items-center gap-0.5" title={comments != null ? `${comments.toLocaleString()} comments` : 'No comment data'}>
        <RiChat3Line className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {comments != null ? formatCompactNumber(comments) : '–'}
        </span>
      </div>
    </div>
  )
}
