/**
 * Raw Calls Service — source-specific queries for detail views.
 *
 * Each raw table stores source-specific metadata that doesn't belong in the
 * canonical recordings table. These queries are used by detail views to show
 * source-specific information (e.g., YouTube stats, Zoom participants).
 *
 * List views should ONLY query the canonical recordings table.
 *
 * Org scoping: raw call tables (fathom_calls, zoom_raw_calls, etc.) do not have
 * organization_id columns. Org isolation is enforced indirectly — callers must
 * only pass recordingIds that were fetched from org-scoped recordings queries.
 * getRawCallData is always called with a recording that was already verified to
 * belong to the active org (via getRecordingById/getRecordingByLegacyId with org filter).
 */

import { supabase } from '@/integrations/supabase/client'
import type { ConnectorSourceApp } from '@/components/connectors/registry/types'
import type { FathomRawCall, ZoomRawCall, YouTubeRawCall, UploadRawFile } from '@/types/raw-calls'

type RawCallDataBySource = {
  fathom: FathomRawCall
  zoom: ZoomRawCall
  youtube: YouTubeRawCall
  'file-upload': UploadRawFile
}

type RawCallSourceApp = keyof RawCallDataBySource
type RawCallData = RawCallDataBySource[RawCallSourceApp]

interface RawCallQueryConfig<SourceApp extends RawCallSourceApp> {
  table: string
  recordingIdColumn: string
  errorLabel: string
  cast: (data: unknown) => RawCallDataBySource[SourceApp] | null
}

const RAW_CALL_QUERY_CONFIG = {
  fathom: {
    table: 'fathom_calls',
    recordingIdColumn: 'canonical_recording_id',
    errorLabel: 'fathom_calls',
    cast: (data) => data as FathomRawCall | null,
  },
  zoom: {
    table: 'zoom_raw_calls',
    recordingIdColumn: 'recording_id',
    errorLabel: 'zoom_raw_calls',
    cast: (data) => data as ZoomRawCall | null,
  },
  youtube: {
    table: 'youtube_raw_calls',
    recordingIdColumn: 'recording_id',
    errorLabel: 'youtube_raw_calls',
    cast: (data) => data as YouTubeRawCall | null,
  },
  'file-upload': {
    table: 'upload_raw_files',
    recordingIdColumn: 'recording_id',
    errorLabel: 'upload_raw_files',
    cast: (data) => data as UploadRawFile | null,
  },
} as const satisfies {
  [SourceApp in RawCallSourceApp]: RawCallQueryConfig<SourceApp>
}

/**
 * Fetches source-specific raw data for a recording. Each source can use a
 * different raw table and recording-id column while the detail view calls one
 * stable service API.
 */
async function fetchRawCallData<SourceApp extends RawCallSourceApp>(
  recordingId: string,
  config: RawCallQueryConfig<SourceApp>,
): Promise<RawCallDataBySource[SourceApp] | null> {
  const { data, error } = await supabase
    .from(config.table)
    .select('*')
    .eq(config.recordingIdColumn, recordingId)
    .maybeSingle()

  if (error) {
    console.error(`Failed to fetch ${config.errorLabel} for ${recordingId}:`, error)
    return null
  }

  return config.cast(data)
}

function isRawCallSourceApp(
  sourceApp: string | null | undefined,
): sourceApp is RawCallSourceApp {
  return !!sourceApp && sourceApp in RAW_CALL_QUERY_CONFIG
}

/**
 * Fetches raw call data for a recording based on its source_app.
 * Returns the appropriate raw table data or null if not found.
 */
export async function getRawCallData(
  recordingId: string,
  sourceApp: string | null | undefined,
): Promise<RawCallData | null> {
  if (!isRawCallSourceApp(sourceApp)) return null
  return fetchRawCallData(recordingId, RAW_CALL_QUERY_CONFIG[sourceApp])
}

export function supportsRawCallData(
  sourceApp: ConnectorSourceApp | string | null | undefined,
): sourceApp is RawCallSourceApp {
  return isRawCallSourceApp(sourceApp)
}
