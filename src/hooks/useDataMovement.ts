/**
 * useDataMovement — TanStack Query mutation hooks for moving/copying recordings.
 *
 * Wraps data-movement.service.ts with cache invalidation and toast feedback.
 *
 * Two operations:
 * 1. moveRecordingsToWorkspace — Move/copy recordings within the same org
 * 2. copyRecordingsToOrganization — Copy recordings to a different org (via RPC)
 *
 * @pattern tanstack-query-hooks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-config'
import {
  moveRecordingsToWorkspace,
  copyRecordingsToOrganization,
  type MoveOptions,
  type CopyOptions,
} from '@/services/data-movement.service'

/**
 * Mutation to move or copy recordings to a different workspace (same org).
 *
 * On success:
 * - Invalidates workspace recordings and workspace entries caches
 * - Shows toast with result
 */
export function useMoveToWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recordingIds,
      targetWorkspaceId,
      options,
    }: {
      recordingIds: string[]
      targetWorkspaceId: string
      options?: MoveOptions
    }) => moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, options),

    onSuccess: (_data, { recordingIds, targetWorkspaceId, options }) => {
      const isCopy = options?.keepInSource === true
      const count = recordingIds.length
      const label = count === 1 ? 'recording' : 'recordings'
      const verb = isCopy ? 'Copied' : 'Moved'

      toast.success(`${verb} ${count} ${label}`)

      // Invalidate workspace recordings and entries for both source and target
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceEntries.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all })
      // TranscriptsTab uses "tag-calls" as its query key (not in queryKeys factory)
      queryClient.invalidateQueries({ queryKey: ['tag-calls'] })

      if (options?.sourceWorkspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.recordings(options.sourceWorkspaceId),
        })
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.recordings(targetWorkspaceId),
      })
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to move recordings')
    },
  })
}

/**
 * Mutation to copy recordings to a different organization (cross-org copy via RPC).
 *
 * On success:
 * - Invalidates organization and recordings caches
 * - Shows toast (also shown by the service itself)
 */
export function useCopyToOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recordingIds,
      targetOrgId,
      options,
    }: {
      recordingIds: string[]
      targetOrgId: string
      options?: CopyOptions
    }) => copyRecordingsToOrganization(recordingIds, targetOrgId, options),

    onSuccess: (_data, { recordingIds, options }) => {
      const count = recordingIds.length
      const label = count === 1 ? 'recording' : 'recordings'
      const verb = options?.removeSource ? 'Moved' : 'Copied'
      toast.success(`${verb} ${count} ${label} to organization`)

      // Invalidate all recording-related caches since cross-org copies
      // create new recordings in the target org
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceEntries.all })
      // TranscriptsTab uses "tag-calls" as its query key (not in queryKeys factory)
      queryClient.invalidateQueries({ queryKey: ['tag-calls'] })

      // If remove_source was set, invalidate source org recordings too
      if (options?.removeSource) {
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      }
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to copy recordings to organization')
    },
  })
}
