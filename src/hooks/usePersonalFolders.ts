import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPersonalFolders,
  createPersonalFolder,
  updatePersonalFolder,
  deletePersonalFolder,
  getPersonalFolderAssignments,
  assignCallToPersonalFolder,
  removeCallFromPersonalFolder,
  moveCallToPersonalFolder,
  type PersonalFolder
} from '@/services/personal-folders.service'

/**
 * Hook to get all personal folder assignments for the organization.
 */
export function usePersonalFolderAssignments(organizationId?: string | null) {
  const { session } = useAuth()
  return useQuery<Record<string, string[]>>({
    queryKey: ['personal_folder_assignments', organizationId],
    queryFn: () => getPersonalFolderAssignments(organizationId!),
    enabled: !!session && !!organizationId,
  })
}

/**
 * Mutation to assign a call to a personal folder.
 */
export function useAssignCallToPersonalFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recordingId,
      folderId,
    }: {
      recordingId: string
      folderId: string
    }) => assignCallToPersonalFolder(recordingId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['personal_folder_assignments'],
      })
      toast.success('Call assigned to personal folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to assign call')
    },
  })
}

/**
 * Mutation to remove a call from a personal folder.
 */
export function useRemoveCallFromPersonalFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recordingId,
      folderId,
    }: {
      recordingId: string
      folderId: string
    }) => removeCallFromPersonalFolder(recordingId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['personal_folder_assignments'],
      })
      toast.success('Call removed from personal folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to remove call')
    },
  })
}

/**
 * Mutation to delete a personal folder.
 */
export function useDeletePersonalFolder(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (folderId: string) => deletePersonalFolder(folderId),
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['personal_folders', organizationId],
        })
      }
      toast.success('Folder deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to delete folder')
    },
  })
}

/**
 * Fetches folders for the given organization mapping to the active user.
 */
export function usePersonalFolders(organizationId: string | null) {
  const { session } = useAuth()

  return useQuery<PersonalFolder[]>({
    queryKey: ['personal_folders', organizationId],
    queryFn: () => getPersonalFolders(organizationId!),
    enabled: !!session && !!organizationId,
  })
}

/**
 * Mutation to create a new personal folder inside the organization.
 */
export function useCreatePersonalFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      organizationId,
      name,
    }: {
      organizationId: string
      name: string
    }) => createPersonalFolder(organizationId, name),
    onSuccess: (_data, { organizationId }) => {
      queryClient.invalidateQueries({
        queryKey: ['personal_folders', organizationId],
      })
      toast.success('Folder created')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to create folder')
    },
  })
}

/**
 * Mutation to rename a personal folder.
 */
export function useRenamePersonalFolder(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string, name: string }) =>
      updatePersonalFolder(folderId, name),

    onMutate: async ({ folderId, name }) => {
      if (!organizationId) return {}

      const queryKey = ['personal_folders', organizationId]

      await queryClient.cancelQueries({ queryKey })

      const previousFolders = queryClient.getQueryData<PersonalFolder[]>(queryKey)

      queryClient.setQueryData<PersonalFolder[]>(queryKey, (old) =>
        (old ?? []).map((f) => (f.id === folderId ? { ...f, name } : f))
      )

      return { previousFolders, queryKey }
    },

    onError: (_error, _variables, context) => {
      if (context?.previousFolders !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousFolders)
      }
      toast.error('Failed to rename folder')
    },

    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['personal_folders', organizationId],
        })
      }
    },
  })
}
