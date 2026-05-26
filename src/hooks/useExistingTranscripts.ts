import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import {
  fetchSyncedCalls,
  type SyncedCallsResult,
} from "@/services/sync-tab.service";
import { queryKeys } from "@/lib/query-config";

/**
 * Existing (already-synced) transcripts for the Sync tab.
 *
 * TanStack-backed wrapper around `fetchSyncedCalls`. Disabled when there is
 * no date range — the user hasn't searched yet — which matches the prior
 * effect-driven behaviour but removes the 500ms cache-busting setTimeout.
 *
 * Cache invalidation flows through `queryKeys.transcripts.synced(...)`: the
 * cancel-job and sync-meetings mutations both invalidate that key on success.
 */
export interface UseExistingTranscriptsArgs {
  dateRange: DateRange | undefined;
  page: number;
  pageSize: number;
  organizationId?: string | null;
}

export function useExistingTranscripts(args: UseExistingTranscriptsArgs) {
  const enabled = Boolean(args.dateRange?.from || args.dateRange?.to);

  const filtersKey = {
    from: args.dateRange?.from?.toISOString() ?? null,
    to: args.dateRange?.to?.toISOString() ?? null,
    page: args.page,
    pageSize: args.pageSize,
    organizationId: args.organizationId ?? null,
  };

  return useQuery<SyncedCallsResult>({
    queryKey: queryKeys.transcripts.synced(filtersKey),
    queryFn: () =>
      fetchSyncedCalls({
        dateRange: args.dateRange,
        page: args.page,
        pageSize: args.pageSize,
        organizationId: args.organizationId,
      }),
    enabled,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}
