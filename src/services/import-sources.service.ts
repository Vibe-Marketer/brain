/**
 * Import Sources Service
 *
 * CRUD operations for the import_sources table and related data.
 * Each row represents a connected source (Fathom, Zoom, YouTube, file-upload)
 * for a specific user — active/inactive toggle, last sync time, error state.
 *
 * Pattern: flat exported async functions, same as recordings.service.ts.
 */

import { supabase } from '@/integrations/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportSource {
  id: string
  user_id: string
  source_app: string
  is_active: boolean
  account_email: string | null
  last_sync_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ImportSourceWithCount extends ImportSource {
  call_count: number
}

export interface FailedImport {
  source_app: string
  failed_external_id: string
  error_message: string | null
  sync_job_id: string
}

// ---------------------------------------------------------------------------
// Source queries
// ---------------------------------------------------------------------------

export async function getImportSources(): Promise<ImportSource[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return []

  // 1. Fetch from import_sources (the new way)
  const { data: sourceRows, error: sourceError } = await supabase
    .from('import_sources')
    .select('id, user_id, source_app, is_active, account_email, last_sync_at, error_message, created_at, updated_at')
    .order('source_app', { ascending: true })

  if (sourceError) {
    throw new Error(`Failed to fetch import sources: ${sourceError.message}`)
  }

  // 2. Fetch from user_settings (the legacy way) for fallback
  const { data: settings } = await supabase
    .from('user_settings')
    .select('fathom_api_key, oauth_access_token, oauth_refresh_token, oauth_token_expires, zoom_oauth_access_token, zoom_oauth_refresh_token, zoom_oauth_token_expires')
    .eq('user_id', user.id)
    .maybeSingle()

  // 3. Merge legacy connections as virtual sources if they don't exist in import_sources
  const finalSources = [...(sourceRows ?? [])]
  const appsWithRow = new Set(finalSources.map((s) => s.source_app))
  const now = Date.now()

  if (settings) {
    // Check Fathom legacy connection
    const hasFathomToken = !!(
      settings.fathom_api_key || 
      settings.oauth_refresh_token || 
      (settings.oauth_access_token && settings.oauth_token_expires && settings.oauth_token_expires > now)
    )
    
    // Check Zoom legacy connection
    const hasZoomToken = !!(
      settings.zoom_oauth_refresh_token || 
      (settings.zoom_oauth_access_token && settings.zoom_oauth_token_expires && settings.zoom_oauth_token_expires > now)
    )

    // Mark existing DB rows as errored if tokens are actually missing
    for (const source of finalSources) {
      if (source.source_app === 'fathom' && !hasFathomToken) {
        source.error_message = 'Connection expired or missing. Please reconnect.'
        source.is_active = false
      }
      if (source.source_app === 'zoom' && !hasZoomToken) {
        source.error_message = 'Connection expired or missing. Please reconnect.'
        source.is_active = false
      }
    }

    if (hasFathomToken && !appsWithRow.has('fathom')) {
      finalSources.push({
        id: 'legacy-fathom',
        user_id: user.id,
        source_app: 'fathom',
        is_active: true,
        account_email: 'Connected (Legacy)',
        last_sync_at: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (hasZoomToken && !appsWithRow.has('zoom')) {
      finalSources.push({
        id: 'legacy-zoom',
        user_id: user.id,
        source_app: 'zoom',
        is_active: true,
        account_email: 'Connected (Legacy)',
        last_sync_at: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  }

  return finalSources
}

/**
 * Returns a mapping of source_app -> call count for the current user.
 * Counts from the recordings table only (single source of truth).
 */
export async function getImportCounts(): Promise<Record<string, number>> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) return {}

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_import_counts', {
    p_user_id: user.id,
  })

  const counts: Record<string, number> = {}
  if (!rpcError && Array.isArray(rpcData)) {
    for (const row of rpcData as { source_app: string; call_count: number }[]) {
      counts[row.source_app] = (counts[row.source_app] || 0) + Number(row.call_count)
    }
  }

  return counts
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Toggles the is_active flag for an import source.
 * Also bumps updated_at so the sync engine knows to re-read the row.
 */
export async function toggleSourceActive(
  sourceId: string,
  isActive: boolean
): Promise<ImportSource> {
  // Handle legacy virtual IDs
  if (sourceId.startsWith('legacy-')) {
    const app = sourceId.replace('legacy-', '')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Must be authenticated to toggle source')

    const { data, error } = await supabase
      .from('import_sources')
      .upsert({
        user_id: user.id,
        source_app: app,
        is_active: isActive,
        account_email: 'Connected (Legacy)',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, source_app' })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to toggle legacy source: ${error.message}`)
    }
    return data
  }

  const { data, error } = await supabase
    .from('import_sources')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', sourceId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to toggle source: ${error.message}`)
  }

  return data
}

/**
 * Upserts an import source row.
 * Called when a user connects a new OAuth source — creates the row if it
 * doesn't exist, updates account_email if it already does.
 * Conflict key: (user_id, source_app) — matches the DB UNIQUE constraint.
 */
export async function upsertImportSource(source: {
  source_app: string
  account_email?: string
}): Promise<ImportSource> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Must be authenticated to connect a source')

  const { data, error } = await supabase
    .from('import_sources')
    .upsert(
      {
        user_id: user.id,
        source_app: source.source_app,
        account_email: source.account_email ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,source_app' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert import source: ${error.message}`)
  }

  return data
}

/**
 * Uploads a file to the file-upload-transcribe edge function for Whisper transcription.
 * Returns the new recording ID so the UI can navigate to it.
 *
 * Per locked decision: 25MB limit is enforced client-side before calling this.
 */
export async function uploadFile(file: File): Promise<{ recordingId: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const { data, error } = await supabase.functions.invoke('file-upload-transcribe', {
    body: formData,
  })

  if (error) {
    throw new Error(`File upload failed: ${error.message}`)
  }

  if (!data?.recordingId) {
    throw new Error('File upload succeeded but no recording ID returned')
  }

  return { recordingId: data.recordingId as string }
}

/**
 * Disconnects an import source by deleting its row.
 * Per locked decision: imported calls are kept; only future syncs stop.
 */
export async function disconnectImportSource(sourceId: string): Promise<void> {
  const { error } = await supabase
    .from('import_sources')
    .delete()
    .eq('id', sourceId)

  if (error) {
    throw new Error(`Failed to disconnect source: ${error.message}`)
  }
}

/**
 * Retries a single failed import by dispatching to the appropriate connector.
 * - fathom   → sync-meetings     with { singleCallId }
 * - zoom     → zoom-sync-meetings with { singleCallId }
 * - youtube  → youtube-import    with { singleCallId }
 * - file-upload → error (user must re-upload)
 */
export async function retryFailedImport(
  sourceApp: string,
  failedExternalId: string
): Promise<{ success: boolean; error?: string }> {
  const edgeFunctionMap: Record<string, string> = {
    fathom: 'sync-meetings',
    zoom: 'zoom-sync-meetings',
    youtube: 'youtube-import',
  }

  if (sourceApp === 'file-upload') {
    return {
      success: false,
      error: 'File uploads cannot be retried automatically. Please re-upload the file.',
    }
  }

  const fnName = edgeFunctionMap[sourceApp]
  if (!fnName) {
    return { success: false, error: `Unknown source: ${sourceApp}` }
  }

  const { error } = await supabase.functions.invoke(fnName, {
    body: { singleCallId: failedExternalId },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Fetches failed imports from sync_jobs where failed_ids array is non-empty.
 * Joins with import_sources to get the source_app name.
 */
export async function getFailedImports(): Promise<FailedImport[]> {
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('id, failed_ids, error, type')
    .not('failed_ids', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.warn('Failed to fetch failed imports:', error.message)
    return []
  }

  if (!data || data.length === 0) return []

  // Get user once — use cached session to avoid N+1 /auth/v1/user requests
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return []

  // Get all synced external_ids to filter out false-positives
  // Check BOTH source_metadata.external_id and legacy_recording_id
  const { data: syncedRecs } = await supabase
    .from('recordings')
    .select('source_metadata, legacy_recording_id')
    .eq('owner_user_id', user.id)

  const syncedIds = new Set<string>()
  if (syncedRecs) {
    for (const r of syncedRecs) {
      const extId = (r.source_metadata as any)?.external_id
      if (extId) syncedIds.add(String(extId))
      if ((r as any).legacy_recording_id) syncedIds.add(String((r as any).legacy_recording_id))
    }
  }

  // Flatten: one FailedImport per failed external_id
  const results: FailedImport[] = []
  const jobs = data as any[]
  for (const job of jobs) {
    if (!job.failed_ids || job.failed_ids.length === 0) continue
    
    for (const externalId of job.failed_ids) {
      const extStr = String(externalId)
      // If it's already in recordings table, ignore it
      if (syncedIds.has(extStr)) continue

      // Derive source_app from job type
      const type = job.type?.toLowerCase();
      const sourceApp = (type === 'sync' || !type) ? 'fathom' : type;

      results.push({
        source_app: sourceApp,
        failed_external_id: extStr,
        error_message: job.error,
        sync_job_id: job.id,
      });
    }
  }

  // Final dedupe by external_id (only show the most recent failure for a specific call)
  const dedupedMap = new Map<string, FailedImport>()
  for (const res of results) {
    if (!dedupedMap.has(res.failed_external_id)) {
      dedupedMap.set(res.failed_external_id, res)
    }
  }

  return Array.from(dedupedMap.values());
}
