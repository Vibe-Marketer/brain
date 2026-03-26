import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/types/supabase'

type RecordingRow = Database['public']['Tables']['recordings']['Row']

/** Narrower type for the calls list view — excludes heavy fields like full_transcript */
export type RecordingListItem = Pick<
  RecordingRow,
  | 'id'
  | 'title'
  | 'recording_start_time'
  | 'duration'
  | 'source_app'
  | 'source_call_id'
  | 'summary'
  | 'global_tags'
  | 'source_metadata'
  | 'legacy_recording_id'
>

/** Full recording type — used for the call detail view */
export type RecordingDetail = RecordingRow

/** Column list for detail queries — shared between getRecordingById and getRecordingByLegacyId */
const RECORDING_DETAIL_COLUMNS =
  'id, title, recording_start_time, recording_end_time, duration, source_app, source_call_id, summary, global_tags, source_metadata, full_transcript, audio_url, video_url, owner_user_id, created_at, organization_id, updated_at, synced_at, legacy_recording_id'

/**
 * Fetches a single recording by UUID.
 * Returns null if the recording does not exist or is not accessible to the current user.
 */
export async function getRecordingById(id: string): Promise<RecordingDetail | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select(RECORDING_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch recording ${id}: ${error.message}`)
  }

  return data
}

/**
 * Fetches a single recording by legacy_recording_id (integer from fathom_calls).
 * Used for backward-compatible URL routing where call detail pages use the legacy integer ID.
 */
export async function getRecordingByLegacyId(legacyId: number): Promise<RecordingDetail | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select(RECORDING_DETAIL_COLUMNS)
    .eq('legacy_recording_id', legacyId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch recording by legacy ID ${legacyId}: ${error.message}`)
  }

  return data
}

/**
 * Fetches distinct source_app values for an organization.
 * Optionally scoped to a specific workspace via workspace_entries.
 * Returns a deduplicated, sorted array of non-null source_app strings.
 */
export async function getAvailableSources(
  organizationId: string,
  workspaceId?: string | null
): Promise<string[]> {
  if (workspaceId) {
    // Workspace-scoped: JOIN workspace_entries → recordings server-side to avoid
    // passing hundreds of UUIDs in a .in() URL (hits the 8KB PostgREST URL limit).
    // The !inner join filters out workspace_entries with no matching recording.
    // We filter null source_app values client-side (payload is tiny: just strings).
    const { data, error } = await supabase
      .from('workspace_entries')
      .select('recording:recordings!inner(source_app)')
      .eq('workspace_id', workspaceId)

    if (error) {
      throw new Error(`Failed to fetch available sources for workspace: ${error.message}`)
    }

    type Row = { recording: { source_app: string | null } | null }
    const unique = [...new Set(
      (data ?? [])
        .map((e: Row) => e.recording?.source_app)
        .filter(Boolean)
    )] as string[]
    return unique.sort()
  }

  // Org-scoped
  const { data, error } = await supabase
    .from('recordings')
    .select('source_app')
    .eq('organization_id', organizationId)
    .not('source_app', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch available sources: ${error.message}`)
  }

  const unique = [...new Set((data ?? []).map((r: { source_app: string | null }) => r.source_app).filter(Boolean))] as string[]
  return unique.sort()
}

