/**
 * YouTubeOutlierBadge - Placeholder outlier rank display
 *
 * Shows a clearly disabled "coming soon" indicator for the outlier rank column.
 * Styled to look intentionally disabled (not broken or empty).
 *
 * @pattern youtube-outlier-badge
 * @brand-version v4.2
 */

export interface YouTubeOutlierBadgeProps {
  /** Future: outlier rank value (1-100). Currently unused - always shows placeholder. */
  rank?: number | null
  /** Optional className override */
  className?: string
}

export function YouTubeOutlierBadge({ rank: _rank, className }: YouTubeOutlierBadgeProps) {
  return (
    <div
      className={className}
      title="Outlier ranking coming soon"
      aria-label="Outlier ranking coming soon"
    >
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/40 italic">
        <span className="inline-block w-5 text-center border-b border-dashed border-muted-foreground/30">
          –
        </span>
      </span>
    </div>
  )
}
