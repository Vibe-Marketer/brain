import { useQuery } from '@tanstack/react-query'
import {
  getReconciledTranscript,
  getReconciliationEligibility,
  getRecordingLabels,
  type ReconciledTranscriptSegmentRow,
  type ReconciliationEligibility,
  type RecordingLabel,
} from '@/services/reconciledTranscript.service'
import { queryKeys } from '@/lib/query-config'

export interface UseReconciledTranscriptResult {
  data: ReconciledTranscriptSegmentRow[] | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * useReconciledTranscript — fetches the event-level reconciled transcript
 * segments for the "Reconciled" tab (RECON-05/RECON-06).
 *
 * Only fires while the tab is open (`enabled`), mirroring
 * useIdentityEvidence's on-demand fetch pattern — the reconciled read never
 * fires for tabs the user hasn't opened.
 *
 * @param eventId - events.id the open call's recording resolved to.
 * @param enabled - gate controlled by the caller (true only while the
 *   Reconciled tab is active).
 */
export function useReconciledTranscript(
  eventId: string,
  enabled: boolean,
): UseReconciledTranscriptResult {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reconciledTranscript.detail(eventId),
    queryFn: () => getReconciledTranscript(eventId),
    enabled: enabled && !!eventId,
    staleTime: 5 * 60 * 1000,
  })

  return { data, isLoading, error: error as Error | null }
}

export interface UseReconciliationEligibilityResult {
  data: ReconciliationEligibility | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * useReconciliationEligibility — resolves whether the open call's event
 * qualifies for the "Reconciled" tab (2+ recordings sharing the event).
 * Drives conditional rendering of both the tab trigger and the
 * CallDetailHeader "N recordings" badge.
 *
 * @param recordingUuid - recordings.id (canonical UUID) of the open call.
 * @param enabled - gate controlled by the caller (true only while the
 *   dialog is open).
 */
export function useReconciliationEligibility(
  recordingUuid: string,
  enabled: boolean,
): UseReconciliationEligibilityResult {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reconciledTranscript.eligibility(recordingUuid),
    queryFn: () => getReconciliationEligibility(recordingUuid),
    enabled: enabled && !!recordingUuid,
    staleTime: 5 * 60 * 1000,
  })

  return { data, isLoading, error: error as Error | null }
}

export interface UseRecordingLabelsResult {
  data: RecordingLabel[] | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * useRecordingLabels — lazily fetches display titles for a set of agreeing
 * source recordings, for ReconciledSegmentProvenanceBadge's popover body.
 * Only fires while the popover is open, so a segment-dense transcript never
 * fires one lookup per segment on render.
 *
 * @param recordingIds - recordings.id values to label.
 * @param enabled - gate controlled by the caller (true only while open).
 */
export function useRecordingLabels(
  recordingIds: string[],
  enabled: boolean,
): UseRecordingLabelsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reconciledTranscript.recordingLabels(recordingIds),
    queryFn: () => getRecordingLabels(recordingIds),
    enabled: enabled && recordingIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  return { data, isLoading, error: error as Error | null }
}
