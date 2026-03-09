import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-config'
import { getAvailableSources } from '@/services/recordings.service'

/**
 * Fetches distinct source_app values for the current org/workspace context.
 * Returns an empty array while loading or if no sources exist.
 */
export function useAvailableSources(
  organizationId: string | undefined,
  workspaceId?: string | null
) {
  return useQuery({
    queryKey: queryKeys.recordings.availableSources(organizationId ?? '', workspaceId),
    queryFn: () => getAvailableSources(organizationId!, workspaceId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes — sources don't change often
  })
}
