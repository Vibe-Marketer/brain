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
      const recId = effectiveRecordingId || ''

      // Cancel outgoing refetches for both individual and batch queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.workspaceEntries.all,
      })

      // Snapshot previous value
      const previous = queryClient.getQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(recId)
      )

      const optimisticEntry: WorkspaceEntry = {
        id: `temp-${workspaceId}`,
        workspace_id: workspaceId,
        recording_id: recId,
        folder_id: null,
        local_tags: [],
        scores: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Optimistically add the entry to individual query
      queryClient.setQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(recId),
        (old = []) => [...old, optimisticEntry]
      )

      // Also optimistically update any batch queries containing this recording
      queryClient.setQueriesData<WorkspaceEntry[]>(
        { queryKey: ['workspace-entries', 'recording-batch'] },
        (old) => old ? [...old, optimisticEntry] : undefined,
      )

      return { previous }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error — invalidate all to refetch clean state
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
          context.previous
        )
      }
      queryClient.invalidateQueries({
        queryKey: ['workspace-entries', 'recording-batch'],
      })
      toast.error('Failed to add recording to workspace')
    },
    onSettled: (_data, _error, { workspaceId }) => {
      // Invalidate all workspace entry queries (individual + batch) via prefix match
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceEntries.all,
      })
      // Also invalidate workspace recordings so WorkspaceDetailPane refreshes
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.recordings(workspaceId),
      })
    },
    onSuccess: (_data, { workspaceId }) => {
      const workspace = workspaces.find((workspace) => workspace.id === workspaceId)
      toast.success(`Added to ${workspace?.name || 'workspace'}`)
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
      const recId = effectiveRecordingId || ''

      // Cancel outgoing refetches for both individual and batch queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.workspaceEntries.all,
      })

      const previous = queryClient.getQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(recId)
      )

      // Optimistically remove the entry from individual query
      queryClient.setQueryData<WorkspaceEntry[]>(
        queryKeys.workspaceEntries.byRecording(recId),
        (old = []) => old.filter((ve) => ve.workspace_id !== workspaceId)
      )

      // Also optimistically remove from any batch queries
      queryClient.setQueriesData<WorkspaceEntry[]>(
        { queryKey: ['workspace-entries', 'recording-batch'] },
        (old) => old
          ? old.filter((ve) => !(ve.recording_id === recId && ve.workspace_id === workspaceId))
          : undefined,
      )

      return { previous }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error — invalidate all to refetch clean state
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.workspaceEntries.byRecording(effectiveRecordingId || ''),
          context.previous
        )
      }
      queryClient.invalidateQueries({
        queryKey: ['workspace-entries', 'recording-batch'],
      })
      toast.error('Failed to remove recording from workspace')
    },
    onSettled: (_data, _error, { workspaceId }) => {
      // Invalidate all workspace entry queries (individual + batch) via prefix match
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceEntries.all,
      })
      // Also invalidate workspace recordings so WorkspaceDetailPane refreshes
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.recordings(workspaceId),
      })
    },
    onSuccess: (_data, { workspaceId }) => {
      const workspace = workspaces.find((workspace) => workspace.id === workspaceId)
      toast.success(`Removed from ${workspace?.name || 'workspace'}`)
    },
  })

  // Toggle: Add or remove based on current state
  const toggleWorkspace = (workspaceId: string) => {
    // Don't allow removing from personal workspace
    if (personalWorkspace && workspaceId === personalWorkspace.id) {
      toast.error('Recordings cannot be removed from your personal workspace')
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

