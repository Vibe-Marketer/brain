/**
 * useOrganizationMembers - Query + mutation hooks for organization member management
 *
 * Provides:
 * - useOrganizationMembers: fetches members for an organization
 * - useOrganizationInvitations: fetches pending invitations
 * - useUpdateOrgMemberRole: mutation to change a member's role
 * - useRemoveOrgMember: mutation to remove a member
 * - useRevokeOrgInvitation: mutation to revoke a pending invitation
 *
 * @pattern tanstack-query-hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-config'
import {
  getOrganizationMembers,
  updateOrganizationMemberRole,
  removeOrganizationMember,
} from '@/services/organizations.service'
import type { OrganizationMember, OrganizationRole } from '@/services/organizations.service'
import {
  getOrganizationInvitations,
  revokeOrganizationInvitation,
} from '@/services/organization-invitations.service'
import type { OrganizationInvitation } from '@/services/organization-invitations.service'
import { toast } from 'sonner'

/**
 * Fetches all members of an organization.
 * Enabled only when organizationId is provided.
 */
export function useOrganizationMembers(organizationId: string) {
  const query = useQuery<OrganizationMember[]>({
    queryKey: queryKeys.organizations.members(organizationId),
    queryFn: () => getOrganizationMembers(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Fetches pending invitations for an organization.
 * Enabled only when organizationId is provided.
 */
export function useOrganizationInvitations(organizationId: string) {
  const query = useQuery<OrganizationInvitation[]>({
    queryKey: queryKeys.organizations.invitations(organizationId),
    queryFn: () => getOrganizationInvitations(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    invitations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Mutation to update a member's role within an organization.
 * Invalidates the members query on success.
 */
export function useUpdateOrgMemberRole(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ membershipId, newRole }: { membershipId: string; newRole: OrganizationRole }) =>
      updateOrganizationMemberRole(membershipId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(organizationId) })
      toast.success('Role updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role')
    },
  })
}

/**
 * Mutation to remove a member from an organization.
 * Invalidates the members query on success.
 */
export function useRemoveOrgMember(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ membershipId }: { membershipId: string }) =>
      removeOrganizationMember(membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(organizationId) })
      toast.success('Member removed from organization')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member')
    },
  })
}

/**
 * Mutation to revoke a pending invitation.
 * Invalidates the invitations query on success.
 */
export function useRevokeOrgInvitation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ invitationId }: { invitationId: string }) =>
      revokeOrganizationInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations(organizationId) })
      toast.success('Invitation revoked')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke invitation')
    },
  })
}

// Re-export types for convenience
export type { OrganizationMember, OrganizationRole, OrganizationInvitation }
