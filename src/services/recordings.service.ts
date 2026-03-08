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

/**
 * Fetches the authenticated user's recordings list.
 * RLS on the recordings table handles tenant isolation — no user_id filter needed.
 * Ordered by recording_start_time descending (most recent first), nulls last.
 */
export async function getRecordings(): Promise<RecordingListItem[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, source_call_id, summary, global_tags, source_metadata, legacy_recording_id')
    .order('recording_start_time', { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Failed to fetch recordings: ${error.message}`)
  }

  return data ?? []
}

/**
 * Fetches recordings belonging to a specific workspace (vault).
 *
 * Two-step query:
 * 1. Get recording_id values from workspace_entries where workspace_id = workspaceId
 * 2. Fetch recordings whose id matches those recording_ids
 *
 * Returns empty array if no recordings are linked to the workspace.
 * RLS on workspace_entries and recordings handles tenant isolation.
 */
export async function getRecordingsByWorkspace(workspaceId: string): Promise<RecordingListItem[]> {
  // Step 1: Get recording IDs from workspace_entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries, error: entriesError } = await (supabase as any)
    .from('workspace_entries')
    .select('recording_id')
    .eq('workspace_id', workspaceId)

  if (entriesError) {
    throw new Error(`Failed to fetch vault entries for workspace: ${entriesError.message}`)
  }

  const recordingIds: string[] = (entries ?? []).map((e: { recording_id: string }) => e.recording_id)

  // Return empty array if no recordings are linked to this workspace
  if (recordingIds.length === 0) {
    return []
  }

  // Step 2: Fetch recordings by ID
  const { data, error } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, source_call_id, summary, global_tags, source_metadata, legacy_recording_id')
    .in('id', recordingIds)
    .order('recording_start_time', { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Failed to fetch recordings for workspace: ${error.message}`)
  }

  return data ?? []
}

/**
 * Fetches recordings assigned to a specific folder.
 *
 * Two-step query:
 * 1. Get call_recording_id values from folder_assignments where folder_id = folderId
 * 2. Fetch recordings whose legacy_recording_id matches those IDs
 *
 * Returns empty array if no recordings are assigned to the folder.
 * RLS handles tenant isolation.
 */
export async function getRecordingsByFolder(folderId: string): Promise<RecordingListItem[]> {
  // Step 1: Get legacy recording IDs from folder_assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .eq('folder_id', folderId)

  if (assignmentsError) {
    throw new Error(`Failed to fetch folder assignments: ${assignmentsError.message}`)
  }

  const legacyIds: number[] = (assignments ?? []).map(
    (a: { call_recording_id: number }) => a.call_recording_id
  )

  // Return empty array if no recordings are assigned to this folder
  if (legacyIds.length === 0) {
    return []
  }

  // Step 2: Fetch recordings by legacy_recording_id
  const { data, error } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, source_call_id, summary, global_tags, source_metadata, legacy_recording_id')
    .in('legacy_recording_id', legacyIds)
    .order('recording_start_time', { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Failed to fetch recordings for folder: ${error.message}`)
  }

  return data ?? []
}

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

/** Response shape from the delete_recording RPC */
export interface DeleteRecordingResult {
  success?: boolean
  error?: string
  deleted_recording_id?: string
  cleaned_up?: {
    workspace_entries: number
    folder_assignments: number
    call_tags: number
  }
}

/**
 * Deletes a recording and all related workspace entries, folder assignments,
 * and call tags via the delete_recording RPC. The RPC runs as SECURITY DEFINER
 * to bypass the RLS guard that blocks deletion when workspace_entries exist.
 */
export async function deleteRecording(recordingId: string): Promise<DeleteRecordingResult> {
  const { data, error } = await supabase.rpc('delete_recording', {
    p_recording_id: recordingId,
  })

  if (error) {
    throw new Error(`Failed to delete recording: ${error.message}`)
  }

  const result = data as DeleteRecordingResult
  if (result?.error) {
    throw new Error(result.error)
  }

  return result
}
