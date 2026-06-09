import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys, invalidateCallListCaches } from '@/lib/query-config'
import {
  assignCallToFolder,
  removeCallFromFolder,
  moveCallToFolder,
  assignWorkspaceEntryToFolder,
  removeWorkspaceEntryFromFolder,
} from '@/services/folders.service'
import { useAuth } from '@/contexts/AuthContext'
import { isLegacyId } from '@/lib/recording-ids'

/**
 * Mutation to assign a call to a folder.
 *
 * Accepts callRecordingId as number (legacy Fathom ID) or string (recording UUID).
 * Routes to the correct service function based on ID format.
 *
 * On success:
 * - Invalidates folder detail cache
 * - Invalidates recordings list cache (folder badge updates)
 * - Shows toast: "Call moved to {folderName}"
 */
export function useAssignToFolder() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      callRecordingId,
      folderId,
      workspaceId,
    }: {
      callRecordingId: number | string
      folderId: string
      folderName?: string
      workspaceId?: string | null
    }) => {
      if (!user) throw new Error('Must be authenticated to assign calls to folders')
      if (isLegacyId(callRecordingId)) {
        return assignCallToFolder(callRecordingId as number, folderId, user.id)
      } else {
        return assignWorkspaceEntryToFolder(callRecordingId as string, folderId, workspaceId ?? '')
      }
    },
    onSuccess: (_data, { folderId, folderName }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(folderId),
      })
      invalidateCallListCaches(queryClient)
      toast.success(folderName ? `Call moved to ${folderName}` : 'Call added to folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to assign call to folder')
    },
    onSettled: () => {
      invalidateCallListCaches(queryClient)
    },
  })
}

/**
 * Mutation to remove a call from a folder.
 *
 * Accepts callRecordingId as number (legacy Fathom ID) or string (recording UUID).
 */
export function useRemoveFromFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      callRecordingId,
      folderId,
      workspaceId,
    }: {
      callRecordingId: number | string
      folderId: string
      workspaceId?: string | null
    }) => {
      if (isLegacyId(callRecordingId)) {
        return removeCallFromFolder(callRecordingId as number, folderId, workspaceId)
      } else {
        return removeWorkspaceEntryFromFolder(callRecordingId as string, folderId, workspaceId ?? '')
      }
    },
    onSuccess: (_data, { folderId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(folderId),
      })
      invalidateCallListCaches(queryClient)
      toast.success('Call removed from folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to remove call from folder')
    },
    onSettled: () => {
      invalidateCallListCaches(queryClient)
    },
  })
}

/**
 * Mutation to move a call from one folder to another.
 *
 * Accepts callRecordingId as number (legacy Fathom ID) or string (recording UUID).
 */
export function useMoveToFolder() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      callRecordingId,
      fromFolderId,
      toFolderId,
      workspaceId,
    }: {
      callRecordingId: number | string
      fromFolderId: string
      toFolderId: string
      folderName?: string
      workspaceId?: string | null
    }) => {
      if (!user) throw new Error('Must be authenticated to move calls between folders')
      if (isLegacyId(callRecordingId)) {
        return moveCallToFolder(callRecordingId as number, fromFolderId, toFolderId, user.id, workspaceId)
      } else {
        return removeWorkspaceEntryFromFolder(callRecordingId as string, fromFolderId, workspaceId ?? '')
          .then(() => assignWorkspaceEntryToFolder(callRecordingId as string, toFolderId, workspaceId ?? ''))
      }
    },
    onSuccess: (_data, { fromFolderId, toFolderId, folderName }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(fromFolderId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(toFolderId),
      })
      invalidateCallListCaches(queryClient)
      toast.success(folderName ? `Call moved to ${folderName}` : 'Call moved to folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to move call to folder')
    },
    onSettled: () => {
      invalidateCallListCaches(queryClient)
    },
  })
}
