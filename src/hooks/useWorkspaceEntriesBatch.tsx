import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryKeys } from '@/lib/query-config'
import type { WorkspaceEntry } from '@/types/workspace'

/**
 * Batch workspace entries context — solves the N+1 query problem.
 *
 * Instead of each WorkspaceBadgeList firing its own
 * `workspace_entries?recording_id=eq.<id>` query, the list view fetches
 * ALL entries for the visible recordings in a single
 * `workspace_entries?recording_id=in.(id1,id2,...)` query, then distributes
 * them via context.
 */

interface WorkspaceEntriesBatchContextValue {
  /** Map of recording_id → WorkspaceEntry[] */
  entriesByRecording: Map<string, WorkspaceEntry[]>
  isLoading: boolean
}

const WorkspaceEntriesBatchContext = createContext<WorkspaceEntriesBatchContextValue | null>(null)

/**
 * Hook to consume batch workspace entries from context.
 * Returns null if no batch provider is present (fallback to individual queries).
 */
export function useWorkspaceEntriesBatch() {
  return useContext(WorkspaceEntriesBatchContext)
}

/**
 * Hook that fetches workspace entries for multiple recordings in a single query.
 */
function useWorkspaceEntriesBatchQuery(recordingIds: string[]) {
  return useQuery({
    queryKey: queryKeys.workspaceEntries.byRecordingBatch(recordingIds),
    queryFn: async (): Promise<WorkspaceEntry[]> => {
      if (recordingIds.length === 0) return []

      const { data, error } = await supabase
        .from('workspace_entries')
        .select('id, workspace_id:workspace_id, recording_id, folder_id, local_tags, scores, notes, created_at, updated_at')
        .in('recording_id', recordingIds)

      if (error) throw error
      return (data || []) as WorkspaceEntry[]
    },
    enabled: recordingIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes — same as individual queries
  })
}

interface WorkspaceEntriesBatchProviderProps {
  /** Recording UUIDs to batch-fetch entries for */
  recordingIds: string[]
  children: React.ReactNode
}

/**
 * Provider that batch-fetches workspace entries for a list of recordings.
 * Wrap around any list view that renders WorkspaceBadgeList for multiple recordings.
 */
export function WorkspaceEntriesBatchProvider({
  recordingIds,
  children,
}: WorkspaceEntriesBatchProviderProps) {
  const { data: entries = [], isLoading } = useWorkspaceEntriesBatchQuery(recordingIds)

  const value = useMemo<WorkspaceEntriesBatchContextValue>(() => {
    const map = new Map<string, WorkspaceEntry[]>()
    for (const entry of entries) {
      const existing = map.get(entry.recording_id)
      if (existing) {
        existing.push(entry)
      } else {
        map.set(entry.recording_id, [entry])
      }
    }
    return { entriesByRecording: map, isLoading }
  }, [entries, isLoading])

  return (
    <WorkspaceEntriesBatchContext.Provider value={value}>
      {children}
    </WorkspaceEntriesBatchContext.Provider>
  )
}
