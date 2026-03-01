import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-config'
import {
  getFolders,
  getArchivedFolders,
  createFolder,
  renameFolder,
  archiveFolder,
  restoreFolder,
} from '@/services/folders.service'
import { useOrgContextStore } from '@/stores/orgContextStore'
import { useAuth } from '@/contexts/AuthContext'
import type { Folder } from '@/types/workspace'

/**
 * Fetches active (non-archived) folders for the given workspace.
 * Only enabled when a session exists and workspaceId is not null.
 *
 * Uses queryKeys.folders.list(workspaceId) as the query key so that
 * mutations can invalidate the correct cache entry.
 */
export function useFolders(workspaceId: string | null) {
  const { session } = useAuth()

  return useQuery<Folder[]>({
    queryKey: queryKeys.folders.list(workspaceId ?? undefined),
    queryFn: () => getFolders(workspaceId!),
    enabled: !!session && !!workspaceId,
  })
}

/**
 * Fetches archived folders for the given workspace.
 * Uses a separate query key: ['folders', 'archived', workspaceId].
 * Only enabled when a session exists and workspaceId is not null.
 */
export function useArchivedFolders(workspaceId: string | null) {
  const { session } = useAuth()

  return useQuery<Folder[]>({
    queryKey: ['folders', 'archived', workspaceId],
    queryFn: () => getArchivedFolders(workspaceId!),
    enabled: !!session && !!workspaceId,
  })
}

/**
 * Mutation to create a new folder inside the active workspace.
 *
 * Requires: workspaceId, bankId, userId (obtained from auth/context).
 * On success: invalidates folders list so the new folder appears.
 */
export function useCreateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      bankId,
      userId,
      name,
      parentFolderId,
    }: {
      workspaceId: string
      bankId: string
      userId: string
      name: string
      parentFolderId?: string
    }) => createFolder(workspaceId, bankId, userId, name, parentFolderId),
    onSuccess: (_data, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(workspaceId),
      })
      toast.success('Folder created')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to create folder')
    },
  })
}

/**
 * Mutation to rename a folder.
 *
 * Uses optimistic update: updates the folder name immediately in the cache
 * and rolls back if the mutation fails.
 */
export function useRenameFolder() {
  const queryClient = useQueryClient()
  const activeWorkspaceId = useOrgContextStore((s) => s.activeWorkspaceId)

  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      renameFolder(folderId, name),

    onMutate: async ({ folderId, name }) => {
      if (!activeWorkspaceId) return {}

      const queryKey = queryKeys.folders.list(activeWorkspaceId)

      // Cancel in-flight fetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current folders for rollback
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKey)

      // Optimistically update the folder name
      queryClient.setQueryData<Folder[]>(queryKey, (old) =>
        (old ?? []).map((f) => (f.id === folderId ? { ...f, name } : f))
      )

      return { previousFolders, queryKey }
    },

    onError: (_error, _variables, context) => {
      // Roll back to snapshot on error
      if (context?.previousFolders !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousFolders)
      }
      toast.error('Failed to rename folder')
    },

    onSuccess: () => {
      // Invalidate to sync with server (optimistic update already applied)
      if (activeWorkspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.folders.list(activeWorkspaceId),
        })
      }
    },
  })
}

/**
 * Mutation to archive a folder.
 * On success: invalidates both active and archived folder lists.
 */
export function useArchiveFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ folderId, workspaceId }: { folderId: string; workspaceId: string }) =>
      archiveFolder(folderId),
    onSuccess: (_data, { workspaceId }) => {
      // Invalidate active folders (folder disappears from main list)
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(workspaceId),
      })
      // Invalidate archived folders (folder appears in archived list)
      queryClient.invalidateQueries({
        queryKey: ['folders', 'archived', workspaceId],
      })
      toast.success('Folder archived')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to archive folder')
    },
  })
}

/**
 * Mutation to restore an archived folder.
 * On success: invalidates both active and archived folder lists.
 */
export function useRestoreFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ folderId, workspaceId }: { folderId: string; workspaceId: string }) =>
      restoreFolder(folderId),
    onSuccess: (_data, { workspaceId }) => {
      // Invalidate active folders (folder reappears in main list)
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(workspaceId),
      })
      // Invalidate archived folders (folder leaves archived list)
      queryClient.invalidateQueries({
        queryKey: ['folders', 'archived', workspaceId],
      })
      toast.success('Folder restored')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to restore folder')
    },
  })
}
