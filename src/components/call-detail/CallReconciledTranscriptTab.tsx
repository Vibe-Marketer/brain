import { memo } from 'react'
import { TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useReconciledTranscript } from '@/hooks/useReconciledTranscript'
import { ReconciledSegmentProvenanceBadge } from '@/components/call-detail/ReconciledSegmentProvenanceBadge'

interface CallReconciledTranscriptTabProps {
  /** events.id the open call's recording resolved to. */
  eventId: string
  /** True only while the "Reconciled" tab is the active tab — gates the
   * on-demand fetch, mirroring CallTranscriptTab's sibling tabs. */
  isOpen: boolean
}

/**
 * CallReconciledTranscriptTab — read-only "Reconciled" tab surfacing the
 * event-level cross-recording transcript (RECON-05/RECON-06).
 *
 * Strictly read-only: no editing state, no manual "regenerate now" action.
 * Reconciliation is entirely sweep-driven on the backend (37-03). Renders
 * ReconciledSegmentProvenanceBadge inline at the end of each multi-source
 * segment only — single-source segments render with zero badge.
 */
export const CallReconciledTranscriptTab = memo(function CallReconciledTranscriptTab({
  eventId,
  isOpen,
}: CallReconciledTranscriptTabProps) {
  const { data: segments, isLoading, error } = useReconciledTranscript(eventId, isOpen)

  return (
    <TabsContent value="reconciled" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="pt-6 pl-6 pr-4 pb-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-montserrat text-sm font-extrabold uppercase tracking-wide mb-3">
                Reconciled Transcript
              </h3>

              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}

              {!isLoading && error && (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Couldn't load the reconciled transcript. Each recording's own transcript is
                    still available in its tab above — try again in a moment.
                  </p>
                </div>
              )}

              {!isLoading && !error && (!segments || segments.length === 0) && (
                <div className="p-8 text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Reconciliation pending</p>
                  <p className="text-sm text-muted-foreground">
                    This event has multiple recordings, but the combined transcript hasn't been
                    generated yet. It will appear automatically once processing completes — no
                    action needed.
                  </p>
                </div>
              )}

              {!isLoading && !error && segments && segments.length > 0 && (
                <div className="space-y-2">
                  {segments.map((segment) => (
                    <p key={segment.id} className="text-sm leading-relaxed text-foreground">
                      {segment.segment_text}{' '}
                      <ReconciledSegmentProvenanceBadge
                        agreeingRecordingIds={segment.agreeing_recording_ids}
                      />
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </TabsContent>
  )
})
