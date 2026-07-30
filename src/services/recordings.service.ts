import { supabase } from '@/integrations/supabase/client'
import { isSourceVisibleInUi, sortSourcePlatforms } from '@/lib/source-display'
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
  | 'fathom_provider_id'
>

/** Full recording type — used for the call detail view */
export type RecordingDetail = RecordingRow

/** Column list for detail queries — shared between getRecordingById and getRecordingByLegacyId */
const RECORDING_DETAIL_COLUMNS =
  'id, title, recording_start_time, recording_end_time, duration, source_app, source_call_id, summary, global_tags, source_metadata, full_transcript, audio_url, video_url, owner_user_id, created_at, organization_id, updated_at, synced_at, fathom_provider_id'

/**
 * Fetches a single recording by UUID.
 * organizationId is required for defense-in-depth — prevents users from fetching
 * recordings from other orgs by guessing UUIDs (ORG-01).
 * Returns null if the recording does not exist or is not accessible to the current user.
 */
export async function getRecordingById(id: string, organizationId: string): Promise<RecordingDetail | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select(RECORDING_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch recording ${id}: ${error.message}`)
  }

  return data
}

/**
 * Fetches a single recording by numeric Fathom provider ID.
 * Used for backward-compatible URL routing where call detail pages use the numeric Fathom ID.
 * organizationId is required for defense-in-depth (ORG-01).
 */
export async function getRecordingByLegacyId(fathomProviderId: number, organizationId: string): Promise<RecordingDetail | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select(RECORDING_DETAIL_COLUMNS)
    .eq('fathom_provider_id', fathomProviderId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch recording by Fathom provider ID ${fathomProviderId}: ${error.message}`)
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
  const activeSourceApps = await getActiveImportSourceApps()

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
    const unique = [...new Set([
      (data ?? [])
        .map((e: Row) => e.recording?.source_app)
        .filter(Boolean),
      ...activeSourceApps,
    ].flat())] as string[]
    return sortSourcePlatforms(unique.filter(isSourceVisibleInUi))
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

  const unique = [...new Set([
    ...(data ?? []).map((r: { source_app: string | null }) => r.source_app).filter(Boolean),
    ...activeSourceApps,
  ])] as string[]
  return sortSourcePlatforms(unique.filter(isSourceVisibleInUi))
}

/** Narrower type for the Control Center recent-calls widget. */
export type RecentRecording = Pick<
  RecordingRow,
  'id' | 'title' | 'recording_start_time' | 'duration' | 'source_app' | 'summary' | 'fathom_provider_id'
>

/**
 * Fetches the most recently recorded calls for an organization, newest first.
 * Used by the Control Center landing page — org-scoped for defense-in-depth (ORG-01).
 */
export async function getRecentRecordings(
  organizationId: string,
  limit = 8
): Promise<RecentRecording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, summary, fathom_provider_id')
    .eq('organization_id', organizationId)
    .order('recording_start_time', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch recent recordings: ${error.message}`)
  }

  return data ?? []
}

export interface RecordingCounts {
  totalCalls: number
  callsThisWeek: number
}

/**
 * Fetches lightweight call-volume counts for an organization: total calls and
 * calls recorded in the last 7 days. Used by the Control Center stat tiles.
 * Uses head:true count-only queries — no row payload transferred.
 */
export async function getRecordingCounts(organizationId: string): Promise<RecordingCounts> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalResult, weekResult] = await Promise.all([
    supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('recording_start_time', sevenDaysAgo),
  ])

  if (totalResult.error) {
    throw new Error(`Failed to fetch total call count: ${totalResult.error.message}`)
  }
  if (weekResult.error) {
    throw new Error(`Failed to fetch weekly call count: ${weekResult.error.message}`)
  }

  return {
    totalCalls: totalResult.count ?? 0,
    callsThisWeek: weekResult.count ?? 0,
  }
}

async function getActiveImportSourceApps(): Promise<string[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return []

  const { data, error } = await supabase
    .from('import_sources')
    .select('source_app')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch connected sources: ${error.message}`)
  }

  return [...new Set(
    (data ?? [])
      .map((row: { source_app: string | null }) => row.source_app)
      .filter(Boolean)
  )] as string[]
}
