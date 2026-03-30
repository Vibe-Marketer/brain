/**
 * useRawCallData — TanStack Query hook for fetching source-specific raw call metadata.
 * Wraps getRawCallData from raw-calls.service.ts.
 */
import { useQuery } from '@tanstack/react-query';
import { getRawCallData } from '@/services/raw-calls.service';
import type { RawCallData } from '@/types/raw-calls';

export function useRawCallData(recordingId: string | undefined, sourceApp: string | null | undefined) {
  return useQuery<RawCallData | null>({
    queryKey: ['raw-call-data', recordingId, sourceApp],
    queryFn: () => getRawCallData(recordingId!, sourceApp),
    enabled: !!recordingId && !!sourceApp,
    staleTime: 10 * 60 * 1000, // 10 minutes — raw data doesn't change
  });
}
