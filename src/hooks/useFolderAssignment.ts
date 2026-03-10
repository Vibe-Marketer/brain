import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-config'
import {
  assignCallToFolder,
  removeCallFromFolder,
  moveCallToFolder,
} from '@/services/folders.service'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Mutation to assign a call to a folder.
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
    }: {
      callRecordingId: number
      folderId: string
      folderName?: string
    }) => {
      if (!user) throw new Error('Must be authenticated to assign calls to folders')
      return assignCallToFolder(callRecordingId, folderId, user.id)
    },
    onSuccess: (_data, { folderId, folderName }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(folderId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.assignments(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.all,
      })
      toast.success(folderName ? `Call moved to ${folderName}` : 'Call added to folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to assign call to folder')
    },
  })
}

/**
 * Mutation to remove a call from a folder.
 */
export function useRemoveFromFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      callRecordingId,
      folderId,
    }: {
      callRecordingId: number
      folderId: string
    }) => removeCallFromFolder(callRecordingId, folderId),
    onSuccess: (_data, { folderId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(folderId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.assignments(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.all,
      })
      toast.success('Call removed from folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to remove call from folder')
    },
  })
}

/**
 * Mutation to move a call from one folder to another.
 */
export function useMoveToFolder() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      callRecordingId,
      fromFolderId,
      toFolderId,
    }: {
      callRecordingId: number
      fromFolderId: string
      toFolderId: string
      folderName?: string
    }) => {
      if (!user) throw new Error('Must be authenticated to move calls between folders')
      return moveCallToFolder(callRecordingId, fromFolderId, toFolderId, user.id)
    },
    onSuccess: (_data, { fromFolderId, toFolderId, folderName }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(fromFolderId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(toFolderId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.assignments(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.all,
      })
      toast.success(folderName ? `Call moved to ${folderName}` : 'Call moved to folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to move call to folder')
    },
  })
}
