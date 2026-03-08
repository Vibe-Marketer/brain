import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryKeys } from '@/lib/query-config'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { toast } from 'sonner'
import type { WorkspaceEntry } from '@/types/workspace'

/**
 * useWorkspaceAssignment - Manage recording <-> workspace assignments
 *
 * Provides queries and mutations for adding/removing recordings from workspaces.
 * Uses Tanstack Query with optimistic updates for snappy UX.
 *
 * Supports two modes:
 * - UUID recording ID (from recordings table) - used directly
 * - Numeric legacy recording ID (from fathom_calls) - resolved to UUID first
 *
 * @param recordingId - UUID recording ID, or null to disable
 * @param legacyRecordingId - Numeric fathom_calls recording_id, used to resolve UUID if recordingId not provided
 */
export function useWorkspaceAssignment(
  recordingId: string | null,
  legacyRecordingId?: number | null,
) {
  const queryClient = useQueryClient()
  const { workspaces, personalWorkspace, activeOrgId } = useOrganizationContext()

  // Resolve UUID from legacy recording ID if needed
  const { data: resolvedRecordingId } = useQuery({
    queryKey: ['recording-uuid-lookup', legacyRecordingId, activeOrgId],
    queryFn: async (): Promise<string | null> => {
      if (!legacyRecordingId || !activeOrgId) return null

      const { data, error } = await supabase
        .from('recordings')
        .select('id')
        .eq('legacy_recording_id', legacyRecordingId)
        .eq('organization_id', activeOrgId)
        .maybeSingle()

      if (error) throw error
      return data?.id || null
    },
    enabled: !recordingId && !!legacyRecordingId && !!activeOrgId,
    staleTime: 10 * 60 * 1000, // 10 minutes - UUIDs don't change
  })

  // Use provided recordingId or resolved one
  const effectiveRecordingId = recordingId || resolvedRecordingId || null

  // Query: Get which workspaces this recording is in
  const {
    data: recordingWorkspaceEntries = [],
    isLoading: entriesLoading,
  } = useQuery({
    queryKey: queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
    queryFn: async (): Promise<WorkspaceEntry[]> => {
      if (!effectiveRecordingId) return []

      const { data, error } = await supabase
        .from('workspace_entries')
        .select('id, workspace_id:workspace_id, recording_id, folder_id, local_tags, scores, notes, created_at, updated_at')
        .eq('recording_id', effectiveRecordingId)

      if (error) throw error
      return (data || []) as WorkspaceEntry[]
    },
    enabled: !!effectiveRecordingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const isLoading = entriesLoading || (!recordingId && !!legacyRecordingId && !resolvedRecordingId)

  // Derived: Set of workspace IDs this recording is in
  const assignedWorkspaceIds = new Set(recordingWorkspaceEntries.map((ve) => ve.workspace_id))

  // Mutation: Add recording to a workspace
  const addToWorkspace = useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      if (!effectiveRecordingId) throw new Error('No recording ID')

      const { data, error } = await supabase
        .from('workspace_entries')
        .insert({
          workspace_id: workspaceId,
          recording_id: effectiveRecordingId,
        })
        .select('id, workspace_id:workspace_id, recording_id, folder_id, local_tags, scores, notes, created_at, updated_at')
        .single()

      if (error) throw error
      return data as WorkspaceEntry
    },
    onMutate: async ({ workspaceId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
      })

      // Snapshot previous value
      const previous = queryClient.getQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(effectiveRecordingId || '')
      )

      // Optimistically add the entry
      queryClient.setQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
        (old = []) => [
          ...old,
          {
            id: `temp-${workspaceId}`,
            workspace_id: workspaceId,
            recording_id: effectiveRecordingId || '',
            folder_id: null,
            local_tags: [],
            scores: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      )

      return { previous }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
          context.previous
        )
      }
      toast.error('Failed to add recording to hub')
    },
    onSettled: (_data, _error, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
      })
      // Also invalidate workspace recordings so WorkspaceDetailPane refreshes
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.recordings(workspaceId),
      })
    },
    onSuccess: (_data, { workspaceId }) => {
      const workspace = workspaces.find((workspace) => workspace.id === workspaceId)
      toast.success(`Added to ${workspace?.name || 'hub'}`)
    },
  })

  // Mutation: Remove recording from a workspace
  const removeFromWorkspace = useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      if (!effectiveRecordingId) throw new Error('No recording ID')

      const { error } = await supabase
        .from('workspace_entries')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('recording_id', effectiveRecordingId)

      if (error) throw error
    },
    onMutate: async ({ workspaceId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
      })

      const previous = queryClient.getQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(effectiveRecordingId || '')
      )

      // Optimistically remove the entry
      queryClient.setQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
        (old = []) => old.filter((ve) => ve.workspace_id !== workspaceId)
      )

      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
          context.previous
        )
      }
      toast.error('Failed to remove recording from hub')
    },
    onSettled: (_data, _error, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
      })
      // Also invalidate workspace recordings so WorkspaceDetailPane refreshes
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.recordings(workspaceId),
      })
    },
    onSuccess: (_data, { workspaceId }) => {
      const workspace = workspaces.find((workspace) => workspace.id === workspaceId)
      toast.success(`Removed from ${workspace?.name || 'hub'}`)
    },
  })

  // Toggle: Add or remove based on current state
  const toggleWorkspace = (workspaceId: string) => {
    // Don't allow removing from personal workspace
    if (personalWorkspace && workspaceId === personalWorkspace.id) {
      toast.error('Recordings cannot be removed from your personal hub')
      return
    }

    if (assignedWorkspaceIds.has(workspaceId)) {
      removeFromWorkspace.mutate({ workspaceId })
    } else {
      addToWorkspace.mutate({ workspaceId })
    }
  }

  return {
    // Data
    recordingWorkspaceEntries,
    assignedWorkspaceIds,
    effectiveRecordingId,
    isLoading,

    // Mutations
    addToWorkspace: addToWorkspace.mutate,
    removeFromWorkspace: removeFromWorkspace.mutate,
    toggleWorkspace,

    // Mutation states
    isAdding: addToWorkspace.isPending,
    isRemoving: removeFromWorkspace.isPending,
  }
}

