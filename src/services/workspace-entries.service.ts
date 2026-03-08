import { supabase } from '@/integrations/supabase/client'
import type { WorkspaceEntry } from '@/types/workspace'

/**
 * Fetch workspace entries for multiple recordings in a single query.
 * Used by WorkspaceEntriesBatchProvider to solve the N+1 query problem.
 */
export async function getWorkspaceEntriesByRecordings(
  recordingIds: string[],
): Promise<WorkspaceEntry[]> {
  if (recordingIds.length === 0) return []

  const { data, error } = await supabase
    .from('workspace_entries')
    .select('id, workspace_id:workspace_id, recording_id, folder_id, local_tags, scores, notes, created_at, updated_at')
    .in('recording_id', recordingIds)

  if (error) throw error
  return (data || []) as WorkspaceEntry[]
}
