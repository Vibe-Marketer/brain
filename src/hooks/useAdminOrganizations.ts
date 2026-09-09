import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listAllOrganizations,
  mergeOrganizations,
  unclaimOrganizationDomain,
  type AdminOrganization,
} from '@/services/admin-organizations.service'
import { queryKeys } from '@/lib/query-config'

/**
 * useAdminOrganizations — the admin org list for the Admin Center's
 * Organizations table (Phase 36-05). Read authority is the admin-read-all
 * RLS policy added alongside this plan; the real write authority for merge
 * and unclaim is each edge function's own server-side has_role(ADMIN) gate
 * (Phase 36-04) — these mutations are convenience wrappers, not the
 * boundary.
 */
export function useAdminOrganizations() {
  return useQuery<AdminOrganization[]>({
    queryKey: queryKeys.adminOrganizations.list(),
    queryFn: listAllOrganizations,
  })
}

interface MergeOrganizationsVariables {
  losingOrganizationId: string
  winningOrganizationId: string
  /** Carried through purely so onError can render the exact UI-SPEC
   * reassurance copy below — the service call itself only needs the two
   * ids. */
  losingOrganizationName: string
}

/**
 * Merges organizations via the merge-organizations edge function. The
 * merge is a canonical_organization_id pointer only (reversible, no data
 * moved) — see MergeOrganizationsDialog for the confirmation copy.
 */
export function useMergeOrganizations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ losingOrganizationId, winningOrganizationId }: MergeOrganizationsVariables) =>
      mergeOrganizations(losingOrganizationId, winningOrganizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOrganizations.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationIdentity.all })
      toast.success('Organizations merged')
    },
    onError: (_error: Error, variables: MergeOrganizationsVariables) => {
      toast.error(`Merge failed — ${variables.losingOrganizationName} was not changed. No data was altered.`)
    },
  })
}

/**
 * Unclaims a domain via the unclaim-organization-domain edge function.
 * Reversible — the domain can be re-claimed later by any organization with
 * a verified email on it.
 */
export function useUnclaimOrganizationDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (domainId: string) => unclaimOrganizationDomain(domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOrganizations.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationIdentity.all })
      toast.success('Domain unclaimed')
    },
    onError: () => {
      // Backstop generic copy per 36-UI-SPEC.md's error/E6-admin-unclaim row —
      // no phase-specific per-code copy was authored for this rare path.
      toast.error('Failed to unclaim domain. Try again.')
    },
  })
}
