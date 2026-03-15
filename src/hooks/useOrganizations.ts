import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-config'
import {
  getOrganizations,
  createOrganization,
} from '@/services/organizations.service'
import type { OrganizationWithRole } from '@/services/organizations.service'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Fetches all organizations the current user belongs to.
 * Only enabled when a session exists (same pattern as useRecordings).
 */
export function useOrganizations() {
  const { session, user } = useAuth()

  return useQuery<OrganizationWithRole[]>({
    queryKey: queryKeys.organizations.list(),
    queryFn: () => getOrganizations(user!.id),
    enabled: !!session && !!user,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Mutation to create a new organization.
 * On success: invalidates organizations cache so the new org appears.
 */
export function useCreateOrganization() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name }: { name: string }) => {
      if (!user) throw new Error('Must be authenticated to create an organization')
      return createOrganization(user.id, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
    },
  })
}
