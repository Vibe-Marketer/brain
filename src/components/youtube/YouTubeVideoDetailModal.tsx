/**
 * YouTubeVideoDetailModal - Full video detail overlay for YouTube workspace recordings
 *
 * Opens when clicking a video in YouTubeVideoList. Shows video summary
 * (thumbnail/title/channel/stats), collapsible description, scrollable
 * transcript, and click-to-start chat section.
 *
 * Follows the same Dialog pattern used by CallDetailDialog but is
 * optimized for YouTube content with video-first layout.
 *
 * @pattern youtube-video-detail-modal
 * @brand-version v4.2
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { YouTubeVideoStats } from '@/components/youtube/YouTubeVideoStats'
import { YouTubeChatSection } from '@/components/youtube/YouTubeChatSection'
import {
  RiTimeLine,
  RiCalendarLine,
  RiPlayLine,
} from '@remixicon/react'
import { getYouTubeMetadata } from '@/types/youtube'
import { parseYouTubeDuration, YOUTUBE_CATEGORIES } from '@/lib/youtube-utils'
import { parseYouTubeTranscript, isYouTubeTranscriptFormat } from '@/lib/transcriptUtils'
import type { WorkspaceRecording } from '@/hooks/useWorkspaces'

export interface YouTubeVideoDetailModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /** Recording to display (null when no selection) */
  recording: WorkspaceRecording | null
  /** Workspace ID for chat scoping */
  workspaceId: string
}



/**
 * Format a date string as relative time (e.g., "3 months ago")
 */
function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '–'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffYears >= 1) return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`
  if (diffMonths >= 1) return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`
  if (diffDays >= 1) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  return 'today'
}

export function YouTubeVideoDetailModal({
  open,
  onOpenChange,
  recording,
  workspaceId,
}: YouTubeVideoDetailModalProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const meta = useMemo(
    () => getYouTubeMetadata(recording?.source_metadata),
    [recording?.source_metadata]
  )

  const duration = useMemo(
    () => (meta?.youtube_duration ? parseYouTubeDuration(meta.youtube_duration) : null),
    [meta?.youtube_duration]
  )

  const categoryName = meta?.youtube_category_id
    ? YOUTUBE_CATEGORIES[meta.youtube_category_id] || null
    : null

  const publishedDate = formatRelativeDate(recording?.recording_start_time)
  const thumbnailUrl = meta?.youtube_thumbnail
  const channelName = meta?.youtube_channel_title || '–'
  const description = meta?.youtube_description || ''
  const hasDescription = description.trim().length > 0
  const transcript = recording?.full_transcript || ''
  const hasTranscript = transcript.trim().length > 0

  // Parse transcript into timestamped segments if in YouTube format
  const transcriptSegments = useMemo(() => {
    if (!hasTranscript) return null
    if (!isYouTubeTranscriptFormat(transcript)) return null
    const segments = parseYouTubeTranscript(transcript, recording?.id)
    return segments.length > 0 ? segments : null
  }, [transcript, hasTranscript, recording?.id])

  // Reset description expanded state when recording changes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsDescriptionExpanded(false)
    }
    onOpenChange(nextOpen)
  }

  if (!recording) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden"
        aria-describedby="youtube-video-detail-description"
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {recording.title || 'Video Details'}
        </DialogTitle>
        <p id="youtube-video-detail-description" className="sr-only">
          Video details including summary, description, transcript, and chat options
        </p>

        <ScrollArea className="max-h-[calc(90vh-2rem)]">
          <div className="p-6 space-y-5">
            {/* ─────── 1. Video Summary (above the fold) ─────── */}
            <section aria-label="Video summary">
              {/* Thumbnail */}
              {thumbnailUrl ? (
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                  <img
                    src={thumbnailUrl}
                    alt={recording.title || 'Video thumbnail'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center mb-4">
                  <RiPlayLine className="h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
                </div>
              )}

              {/* Title */}
              <h3 className="text-lg font-semibold text-foreground leading-snug">
                {recording.title}
              </h3>

              {/* Channel name */}
              <p className="text-sm text-muted-foreground mt-1">{channelName}</p>

              {/* Stats row */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <YouTubeVideoStats
                  views={meta?.youtube_view_count}
                  likes={meta?.youtube_like_count}
                  comments={meta?.youtube_comment_count}
                  className="flex items-center gap-3"
                />

                {/* Duration badge */}
                {duration && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RiTimeLine className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="tabular-nums">{duration.display}</span>
                  </div>
                )}

                {/* Published date */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RiCalendarLine className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{publishedDate}</span>
                </div>

                {/* Category badge */}
                {categoryName && (
                  <Badge
                    variant="outline"
                    className="text-2xs px-1.5 py-0 h-5 font-medium"
                  >
                    {categoryName}
                  </Badge>
                )}
              </div>
            </section>

            {/* ─────── 2. Description (collapsible) ─────── */}
            <section aria-label="Video description">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Description
              </h4>
              {hasDescription ? (
                <div>
                  <p
                    className={cn(
                      'text-sm text-foreground/90 whitespace-pre-line',
                      !isDescriptionExpanded && 'line-clamp-3'
                    )}
                  >
                    {description}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="px-0 h-auto text-xs text-muted-foreground hover:text-foreground mt-1"
                  >
                    {isDescriptionExpanded ? 'Show less' : 'Show more'}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description available</p>
              )}
            </section>

            {/* ─────── 3. Transcript ─────── */}
            <section aria-label="Video transcript">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Transcript
              </h4>
              {hasTranscript ? (
                <div className="max-h-[300px] overflow-y-auto rounded-md border border-border/40 bg-muted/30 p-3">
                  {transcriptSegments ? (
                    // Parsed YouTube format: timestamped paragraphs
                    <div className="space-y-0.5">
                      {transcriptSegments.map((seg, idx) => (
                        <div key={seg.id || idx} className="flex gap-3 py-1.5 border-b border-border/20 last:border-0">
                          <span className="shrink-0 w-10 text-right text-[11px] font-mono text-muted-foreground/70 mt-[2px] select-none">
                            {seg.timestamp}
                          </span>
                          <p className="flex-1 text-sm text-foreground/85 leading-relaxed">
                            {seg.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback: raw text display
                    <p className="text-sm text-foreground/85 whitespace-pre-line leading-relaxed">
                      {transcript}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No transcript available</p>
              )}
            </section>

            {/* ─────── 4. Chat ─────── */}
            <YouTubeChatSection
              workspaceId={workspaceId}
              recordingId={recording.legacy_recording_id ?? null}
              videoTitle={recording.title || 'Untitled video'}
              onClose={() => handleOpenChange(false)}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
