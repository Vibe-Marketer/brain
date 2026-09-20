import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmEmailVerification,
  disconnectVerifiedEmailAlias,
  listVerifiedEmails,
  requestEmailVerification,
  type DisconnectVerifiedEmailResult,
  type VerifiedEmailAlias,
} from '@/services/identity-alias.service'
import { invalidateCallListCaches, queryKeys } from '@/lib/query-config'

export interface UseIdentityAliasesResult {
  verifiedEmails: VerifiedEmailAlias[] | undefined
  isLoading: boolean
  error: Error | null
  requestVerification: (email: string) => Promise<void>
  isRequesting: boolean
  confirmVerification: (params: { email: string; code: string }) => Promise<{ identity_id: string }>
  isConfirming: boolean
  disconnectVerifiedEmail: (aliasId: string) => Promise<DisconnectVerifiedEmailResult>
  isDisconnecting: boolean
  disconnectingAliasId: string | null
}

/**
 * useIdentityAliases — list of the caller's verified email aliases plus the
 * request/confirm mutations for adding a new one (IDENT-03, AccountTab
 * "Verified Emails" section).
 *
 * The confirm mutation invalidates the list on success so a newly verified
 * address appears without a manual refetch.
 */
export function useIdentityAliases(): UseIdentityAliasesResult {
  const queryClient = useQueryClient()

  const {
    data: verifiedEmails,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.identityAliases.verifiedEmails(),
    queryFn: listVerifiedEmails,
    staleTime: 60 * 1000,
  })

  const requestMutation = useMutation({
    mutationFn: (email: string) => requestEmailVerification(email),
  })

  const confirmMutation = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      confirmEmailVerification(email, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.identityAliases.verifiedEmails() })
    },
  })

  const disconnectMutation = useMutation({
    mutationKey: ['identity-aliases', 'disconnect-verified-email'] as const,
    mutationFn: (aliasId: string) => disconnectVerifiedEmailAlias(aliasId),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.identityAliases.verifiedEmails(),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventDiscovery.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accessPolicy.all })
      invalidateCallListCaches(queryClient)
    },
  })

  return {
    verifiedEmails,
    isLoading,
    error: error as Error | null,
    requestVerification: requestMutation.mutateAsync,
    isRequesting: requestMutation.isPending,
    confirmVerification: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,
    disconnectVerifiedEmail: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    disconnectingAliasId: disconnectMutation.isPending
      ? disconnectMutation.variables ?? null
      : null,
  }
}
