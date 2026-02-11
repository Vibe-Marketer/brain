/**
 * YouTubeVideoList - List container with sortable column headers for YouTube videos
 *
 * Renders a column-header row with sort controls, followed by
 * YouTubeVideoRow items for each recording.
 *
 * @pattern youtube-video-list
 * @brand-version v4.2
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { RiArrowUpSLine, RiArrowDownSLine } from '@remixicon/react'
import { YouTubeVideoRow } from '@/components/youtube/YouTubeVideoRow'
import type { VaultRecording } from '@/hooks/useVaults'
import type { YouTubeSortField, SortOrder } from '@/hooks/useYouTubeSearch'

export interface YouTubeVideoListProps {
  /** Recordings to render */
  recordings: VaultRecording[]
  /** Click handler for video selection */
  onVideoClick: (recording: VaultRecording) => void
  /** Current sort field */
  sortBy: YouTubeSortField
  /** Current sort order */
  sortOrder: SortOrder
  /** Sort change handler - toggles order if same field, sets desc if new field */
  onSortChange: (field: YouTubeSortField) => void
  /** Optional className */
  className?: string
}

/** Column header configuration */
const COLUMNS: Array<{
  field: YouTubeSortField | null
  label: string
  width: string
  hideBelow?: string
}> = [
  { field: null, label: '', width: 'w-[120px]' }, // thumbnail spacer
  { field: 'title', label: 'Title', width: 'flex-1 min-w-0' },
  { field: null, label: 'Channel', width: 'w-[140px]', hideBelow: 'lg' },
  { field: 'views', label: 'Stats', width: 'w-[120px]', hideBelow: 'md' },
  { field: 'duration', label: 'Duration', width: 'w-[100px]', hideBelow: 'md' },
  { field: null, label: 'Category', width: 'w-[90px]', hideBelow: 'xl' },
  { field: null, label: 'Outlier', width: 'w-[80px]', hideBelow: 'xl' },
]

/** Map hideBelow breakpoints to Tailwind hidden classes */
const HIDE_CLASSES: Record<string, string> = {
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
  xl: 'hidden xl:flex',
}

export function YouTubeVideoList({
  recordings,
  onVideoClick,
  sortBy,
  sortOrder,
  onSortChange,
  className,
}: YouTubeVideoListProps) {
  const handleColumnClick = useCallback(
    (field: YouTubeSortField | null) => {
      if (field) {
        onSortChange(field)
      }
    },
    [onSortChange]
  )

  return (
    <div className={cn('flex flex-col', className)} role="table" aria-label="YouTube videos">
      {/* Column headers */}
      <div
        className="flex items-center gap-3 px-3 py-1.5 border-b border-border/40"
        role="row"
        aria-label="Column headers"
      >
        {COLUMNS.map((col, idx) => {
          const isSortable = col.field !== null
          const isActive = col.field === sortBy
          const visibilityClass = col.hideBelow ? HIDE_CLASSES[col.hideBelow] : 'flex'

          return (
            <div
              key={col.label || idx}
              className={cn(
                'items-center flex-shrink-0',
                col.width,
                visibilityClass,
                isSortable && 'cursor-pointer select-none group/col',
                !isSortable && 'pointer-events-none'
              )}
              role="columnheader"
              aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
              onClick={() => handleColumnClick(col.field)}
            >
              {col.label && (
                <span
                  className={cn(
                    'text-[11px] font-medium uppercase tracking-wider',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                    isSortable && 'group-hover/col:text-foreground transition-colors'
                  )}
                >
                  {col.label}
                </span>
              )}
              {/* Sort indicator */}
              {isSortable && isActive && (
                <span className="ml-0.5 flex-shrink-0">
                  {sortOrder === 'asc' ? (
                    <RiArrowUpSLine className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                  ) : (
                    <RiArrowDownSLine className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Video rows */}
      <div role="rowgroup">
        {recordings.map((recording) => (
          <YouTubeVideoRow
            key={recording.id}
            recording={recording}
            onVideoClick={onVideoClick}
          />
        ))}
      </div>
    </div>
  )
}
