import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  addOrganizationAlias,
  claimOrganizationDomain,
  listOrganizationAliases,
  listOrganizationDomains,
  removeOrganizationAlias,
  type OrganizationAlias,
  type OrganizationDomain,
} from '@/services/organization-identity.service'
import { queryKeys } from '@/lib/query-config'

export interface UseOrganizationIdentityResult {
  domains: OrganizationDomain[] | undefined
  aliases: OrganizationAlias[] | undefined
  isLoadingDomains: boolean
  isLoadingAliases: boolean
  domainsError: Error | null
  aliasesError: Error | null
  claimDomain: (domain: string) => Promise<void>
  isClaiming: boolean
  addAlias: (alias: string) => Promise<void>
  isAddingAlias: boolean
  removeAlias: (aliasId: string) => Promise<void>
  isRemovingAlias: boolean
}

/**
 * useOrganizationIdentity — reads + mutations for the Organization Identity
 * settings surface (ORG-01/ORG-02): an org's domains and aliases, plus the
 * claim/add/remove mutations. Write authority is enforced server-side
 * (is_organization_admin_or_owner inside each RPC) -- client-side `canManage`
 * gating in the UI is convenience only (T-36-11).
 *
 * @param organizationId - organizations.id to scope both reads to.
 * @param enabled - gate for both queries (default true). Pass a boolean tied
 *   to a popover's open state to fetch lazily -- see VerifiedDomainBadge,
 *   which reuses the domains query this way so N org badges never fire N
 *   queries on mount (mirrors useIdentityEvidence / T-34-05-03, T-36-12).
 */
export function useOrganizationIdentity(
  organizationId: string,
  enabled = true,
): UseOrganizationIdentityResult {
  const queryClient = useQueryClient()

  const {
    data: domains,
    isLoading: isLoadingDomains,
    error: domainsError,
  } = useQuery({
    queryKey: queryKeys.organizationIdentity.domains(organizationId),
    queryFn: () => listOrganizationDomains(organizationId),
    enabled: enabled && !!organizationId,
    staleTime: 60 * 1000,
  })

  const {
    data: aliases,
    isLoading: isLoadingAliases,
    error: aliasesError,
  } = useQuery({
    queryKey: queryKeys.organizationIdentity.aliases(organizationId),
    queryFn: () => listOrganizationAliases(organizationId),
    enabled: enabled && !!organizationId,
    staleTime: 60 * 1000,
  })

  const claimMutation = useMutation({
    mutationFn: (domain: string) => claimOrganizationDomain(organizationId, domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationIdentity.domains(organizationId) })
      toast.success('Domain claimed')
    },
    // No onError toast here (WR-02, 36-REVIEW.md): OrganizationIdentitySection
    // already renders the precise UI-SPEC copy inline for every claim failure
    // code via claimErrorCopy() — a generic toast here would double-message
    // the same single failure with two different sentences.
  })

  const addAliasMutation = useMutation({
    mutationFn: (alias: string) => addOrganizationAlias(organizationId, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationIdentity.aliases(organizationId) })
      toast.success('Alias added')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const removeAliasMutation = useMutation({
    mutationFn: (aliasId: string) => removeOrganizationAlias(aliasId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationIdentity.aliases(organizationId) })
      toast.success('Alias removed')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return {
    domains,
    aliases,
    isLoadingDomains,
    isLoadingAliases,
    domainsError: domainsError as Error | null,
    aliasesError: aliasesError as Error | null,
    claimDomain: claimMutation.mutateAsync,
    isClaiming: claimMutation.isPending,
    addAlias: addAliasMutation.mutateAsync,
    isAddingAlias: addAliasMutation.isPending,
    removeAlias: removeAliasMutation.mutateAsync,
    isRemovingAlias: removeAliasMutation.isPending,
  }
}
