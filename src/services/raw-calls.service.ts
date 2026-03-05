/**
 * Raw Calls Service — source-specific queries for detail views.
 *
 * Each raw table stores source-specific metadata that doesn't belong in the
 * canonical recordings table. These queries are used by detail views to show
 * source-specific information (e.g., YouTube stats, Zoom participants).
 *
 * List views should ONLY query the canonical recordings table.
 */

import { supabase } from '@/integrations/supabase/client'
import type { FathomRawCall, ZoomRawCall, YouTubeRawCall, UploadRawFile } from '@/types/raw-calls'

/**
 * Fetches Fathom-specific raw data for a recording.
 * Joins via canonical_recording_id (UUID FK to recordings).
 */
export async function getFathomRawCall(recordingId: string): Promise<FathomRawCall | null> {
  const { data, error } = await supabase
    .from('fathom_calls')
    .select('*')
    .eq('canonical_recording_id', recordingId)
    .maybeSingle()

  if (error) {
    console.error(`Failed to fetch fathom_calls for ${recordingId}:`, error)
    return null
  }

  return data as FathomRawCall | null
}

/**
 * Fetches Zoom-specific raw data for a recording.
 */
export async function getZoomRawCall(recordingId: string): Promise<ZoomRawCall | null> {
  const { data, error } = await supabase
    .from('zoom_raw_calls')
    .select('*')
    .eq('recording_id', recordingId)
    .maybeSingle()

  if (error) {
    console.error(`Failed to fetch zoom_raw_calls for ${recordingId}:`, error)
    return null
  }

  return data as ZoomRawCall | null
}

/**
 * Fetches YouTube-specific raw data for a recording.
 */
export async function getYouTubeRawCall(recordingId: string): Promise<YouTubeRawCall | null> {
  const { data, error } = await supabase
    .from('youtube_raw_calls')
    .select('*')
    .eq('recording_id', recordingId)
    .maybeSingle()

  if (error) {
    console.error(`Failed to fetch youtube_raw_calls for ${recordingId}:`, error)
    return null
  }

  return data as YouTubeRawCall | null
}

/**
 * Fetches upload-specific raw data for a recording.
 */
export async function getUploadRawFile(recordingId: string): Promise<UploadRawFile | null> {
  const { data, error } = await supabase
    .from('upload_raw_files')
    .select('*')
    .eq('recording_id', recordingId)
    .maybeSingle()

  if (error) {
    console.error(`Failed to fetch upload_raw_files for ${recordingId}:`, error)
    return null
  }

  return data as UploadRawFile | null
}

/**
 * Fetches raw call data for a recording based on its source_app.
 * Returns the appropriate raw table data or null if not found.
 */
export async function getRawCallData(
  recordingId: string,
  sourceApp: string | null | undefined,
): Promise<FathomRawCall | ZoomRawCall | YouTubeRawCall | UploadRawFile | null> {
  switch (sourceApp) {
    case 'fathom':
      return getFathomRawCall(recordingId)
    case 'zoom':
      return getZoomRawCall(recordingId)
    case 'youtube':
      return getYouTubeRawCall(recordingId)
    case 'file-upload':
      return getUploadRawFile(recordingId)
    default:
      return null
  }
}
