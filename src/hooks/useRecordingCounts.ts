import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-config'
import { getRecordingCounts } from '@/services/recordings.service'

/**
 * Fetches total and this-week call counts for the active organization.
 * Powers the Control Center stat tiles.
 */
export function useRecordingCounts(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recordings.counts(organizationId ?? ''),
    queryFn: () => getRecordingCounts(organizationId!),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  })
}
