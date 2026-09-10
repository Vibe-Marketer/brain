import { supabase } from '@/integrations/supabase/client'

/**
 * Reconciled Transcript Service — pure async wrapper over the client-facing
 * `reconciled_transcript_segments` read path (Phase 37-01 migration).
 *
 * Read-only. This service never writes, upserts, or requests regeneration of
 * any transcript source — it is strictly a derived-cache read. RLS-gated via
 * `user_can_view_event_reconciliation`: a user only sees segments for events
 * whose recordings they can already access (see 37-04-PLAN.md threat model
 * T-37-01).
 */

export interface ReconciledTranscriptSegmentRow {
  id: string
  event_id: string
  segment_text: string
  start_time: string | null
  end_time: string | null
  source_recording_ids: string[]
  agreeing_recording_ids: string[]
}

/**
 * Fetches the reconciled (cross-recording) transcript segments for an event,
 * ordered chronologically.
 *
 * @param eventId - events.id the open call's recording resolved to.
 * @returns Reconciled segment rows. Empty array if reconciliation hasn't
 *   swept the event yet (or the event has fewer than 2 resolved recordings).
 * @throws Error if the read fails.
 */
export async function getReconciledTranscript(
  eventId: string,
): Promise<ReconciledTranscriptSegmentRow[]> {
  const { data, error } = await supabase
    .from('reconciled_transcript_segments')
    .select('id, event_id, segment_text, start_time, end_time, source_recording_ids, agreeing_recording_ids')
    .eq('event_id', eventId)
    .order('start_time', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch reconciled transcript: ${error.message}`)
  }

  return data ?? []
}

export interface ReconciliationEligibility {
  eventId: string | null
  recordingCount: number
}

/**
 * Resolves whether a recording's event qualifies for the "Reconciled" tab —
 * i.e. the recording belongs to an event with 2+ recordings. Used to
 * conditionally render the tab trigger + content (never a shown-then-empty
 * disabled tab). Both reads are RLS-gated by the existing `recordings`
 * SELECT policy — no new read surface.
 *
 * @param recordingUuid - recordings.id (canonical UUID) of the open call.
 * @throws Error if either read fails.
 */
export async function getReconciliationEligibility(
  recordingUuid: string,
): Promise<ReconciliationEligibility> {
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('event_id')
    .eq('id', recordingUuid)
    .maybeSingle()

  if (recordingError) {
    throw new Error(`Failed to resolve event for reconciliation eligibility: ${recordingError.message}`)
  }

  const eventId = recording?.event_id ?? null
  if (!eventId) {
    return { eventId: null, recordingCount: 0 }
  }

  const { count, error: countError } = await supabase
    .from('recordings')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (countError) {
    throw new Error(`Failed to count event recordings: ${countError.message}`)
  }

  return { eventId, recordingCount: count ?? 0 }
}
