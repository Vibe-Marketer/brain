import { useQuery } from '@tanstack/react-query'
import { getIdentityEvidence, type IdentityEvidenceRow } from '@/services/identity-evidence.service'
import { queryKeys } from '@/lib/query-config'

export interface UseIdentityEvidenceResult {
  data: IdentityEvidenceRow[] | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * useIdentityEvidence — lazily fetches confidence + evidence for a resolved
 * identity (IDENT-08).
 *
 * Only fires the RPC when `enabled` is true (i.e. when the caller's popover
 * is open), so a call with N resolved speakers never fires N evidence RPCs
 * on render — see 34-05-PLAN.md threat model T-34-05-03.
 *
 * @param identityId - identities.id for the resolved speaker.
 * @param enabled - gate controlled by the caller (true only while open).
 */
export function useIdentityEvidence(identityId: string, enabled: boolean): UseIdentityEvidenceResult {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.identityEvidence.detail(identityId),
    queryFn: () => getIdentityEvidence(identityId),
    enabled: enabled && !!identityId,
    staleTime: 5 * 60 * 1000,
  })

  return { data, isLoading, error: error as Error | null }
}
