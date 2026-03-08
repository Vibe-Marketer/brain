import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPersonalTags,
  createPersonalTag,
  updatePersonalTag,
  deletePersonalTag,
  getPersonalTagAssignments,
  assignTagToRecording,
  removeTagFromRecording,
  type PersonalTag
} from '@/services/personal-tags.service'

export function usePersonalTags(organizationId: string | null) {
  const { session } = useAuth()
  return useQuery<PersonalTag[]>({
    queryKey: ['personal_tags', organizationId],
    queryFn: () => getPersonalTags(organizationId!),
    enabled: !!session && !!organizationId,
  })
}

export function usePersonalTagAssignments(organizationId?: string | null) {
  const { session } = useAuth()
  return useQuery<Record<string, string[]>>({
    queryKey: ['personal_tag_assignments', organizationId],
    queryFn: () => getPersonalTagAssignments(organizationId!),
    enabled: !!session && !!organizationId,
  })
}

export function useAssignTagToRecording() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordingId, tagId }: { recordingId: string; tagId: string }) =>
      assignTagToRecording(recordingId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal_tag_assignments'] })
      toast.success('Tag assigned')
    },
    onError: (error: Error) => toast.error(error.message)
  })
}

export function useRemoveTagFromRecording() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordingId, tagId }: { recordingId: string; tagId: string }) =>
      removeTagFromRecording(recordingId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal_tag_assignments'] })
      toast.success('Tag removed')
    },
    onError: (error: Error) => toast.error(error.message)
  })
}

export function useCreatePersonalTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ organizationId, name, color }: { organizationId: string; name: string; color?: string }) =>
      createPersonalTag(organizationId, name, color),
    onSuccess: (_data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['personal_tags', organizationId] })
      toast.success('Tag created')
    },
    onError: (error: Error) => toast.error(error.message)
  })
}

export function useDeletePersonalTag(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tagId: string) => deletePersonalTag(tagId),
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['personal_tags', organizationId] })
      }
      toast.success('Tag deleted')
    },
    onError: (error: Error) => toast.error(error.message)
  })
}
