import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-config'
import { getRecentRecordings } from '@/services/recordings.service'

/**
 * Fetches the most recently recorded calls for the active organization.
 * Powers the Control Center "Recent Calls" widget.
 */
export function useRecentRecordings(organizationId: string | undefined, limit = 8) {
  return useQuery({
    queryKey: queryKeys.recordings.recent(organizationId ?? '', limit),
    queryFn: () => getRecentRecordings(organizationId!, limit),
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute — recent calls should feel fresh
  })
}
