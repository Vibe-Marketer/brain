import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecordingLabels } from '@/hooks/useReconciledTranscript'
import { RiGitMergeLine } from '@remixicon/react'

interface ReconciledSegmentProvenanceBadgeProps {
  /** recordings.id values that agreed on this segment's text — the row's
   * `agreeing_recording_ids` from reconciled_transcript_segments. Caller
   * must only render this component when agreeing_recording_ids.length
   * >= 2 — single-source segments must never show a badge (RECON-06). */
  agreeingRecordingIds: string[]
}

/**
 * ReconciledSegmentProvenanceBadge — subtle, opt-in-to-notice consensus
 * indicator for a multi-source reconciled transcript segment (RECON-06).
 *
 * Mirrors IdentityEvidenceBadge's popover-trigger pattern exactly (icon-only
 * trigger, w-64 p-3 popover content, lazy fetch on open). Renders nothing
 * when agreeing_recording_ids.length < 2 — the absence of this badge IS the
 * single-source signal (37-UI-SPEC.md Visual Hierarchy).
 */
export function ReconciledSegmentProvenanceBadge({
  agreeingRecordingIds,
}: ReconciledSegmentProvenanceBadgeProps) {
  const [open, setOpen] = useState(false)
  const isMultiSource = agreeingRecordingIds.length >= 2

  // Hook is always called (Rules of Hooks) but only fires its fetch when
  // both `open` and `isMultiSource` are true — single-source segments never
  // mount the popover below and so never open, but the guard is explicit
  // here too as a second line of defense.
  const { data, isLoading, error } = useRecordingLabels(
    agreeingRecordingIds,
    open && isMultiSource,
  )

  // Single-source segments must never render a badge — the absence of a
  // badge IS the single-source signal (RECON-06).
  if (!isMultiSource) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen((prev) => !prev)
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Confirmed by ${agreeingRecordingIds.length} recordings`}
        >
          <RiGitMergeLine className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-64 p-3">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
        {!isLoading && error && (
          <p className="text-sm text-muted-foreground">Unable to load source recordings.</p>
        )}
        {!isLoading && !error && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Confirmed by{' '}
              <span className="tabular-nums">{agreeingRecordingIds.length}</span> recordings
            </p>
            <ul className="space-y-0.5">
              {(data ?? []).map((recording) => (
                <li key={recording.id} className="text-sm text-muted-foreground truncate">
                  {recording.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
