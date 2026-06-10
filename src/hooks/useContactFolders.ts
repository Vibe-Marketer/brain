import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getContactFolders,
  createContactFolder,
  deleteContactFolder,
  assignContactToFolder,
  removeContactFromFolder,
} from '@/services/contact-folders.service'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Query key factory for contact folders.
 */
const contactFolderKeys = {
  all: ['contact-folders'] as const,
  list: (orgId?: string) => ['contact-folders', 'list', orgId] as const,
}

/**
 * Fetches all contact folders for the given organization.
 * Only enabled when a session exists and orgId is provided.
 */
export function useContactFolders(orgId: string | null) {
  const { session } = useAuth()

  return useQuery({
    queryKey: contactFolderKeys.list(orgId ?? undefined),
    queryFn: () => getContactFolders(orgId!),
    enabled: !!session && !!orgId,
  })
}

/**
 * Mutation to create a new contact folder.
 * On success: invalidates contact folders list so the new folder appears.
 */
export function useCreateContactFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      name,
    }: {
      organizationId: string
      userId: string
      name: string
    }) => createContactFolder(organizationId, userId, name),
    onSuccess: (_data, { organizationId }) => {
      queryClient.invalidateQueries({
        queryKey: contactFolderKeys.list(organizationId),
      })
      toast.success('Folder created')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to create folder')
    },
  })
}

/**
 * Mutation to delete a contact folder.
 * On success: invalidates contact folders list.
 */
export function useDeleteContactFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      folderId,
      organizationId: _organizationId,
    }: {
      folderId: string
      organizationId: string
    }) => deleteContactFolder(folderId),
    onSuccess: (_data, { organizationId }) => {
      queryClient.invalidateQueries({
        queryKey: contactFolderKeys.list(organizationId),
      })
      toast.success('Folder deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to delete folder')
    },
  })
}

/**
 * Mutation to assign a contact to a contact folder.
 */
export function useAssignContactToFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      contactFolderId,
      contactId,
    }: {
      contactFolderId: string
      contactId: string
    }) => assignContactToFolder(contactFolderId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contactFolderKeys.all,
      })
      toast.success('Contact added to folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to assign contact')
    },
  })
}

/**
 * Mutation to remove a contact from a contact folder.
 */
export function useRemoveContactFromFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      contactFolderId,
      contactId,
    }: {
      contactFolderId: string
      contactId: string
    }) => removeContactFromFolder(contactFolderId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contactFolderKeys.all,
      })
      toast.success('Contact removed from folder')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to remove contact')
    },
  })
}
