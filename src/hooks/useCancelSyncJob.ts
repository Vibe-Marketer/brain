import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { cancelSyncJob } from "@/services/sync-tab.service";
import { queryKeys } from "@/lib/query-config";

/**
 * Cancels a sync job (sets status=failed + completed_at=now) and invalidates
 * the active-jobs cache so the surface re-renders without the prior
 * `setTimeout(..., 500)` cache-busting workaround.
 *
 * Surface-level error handling is opinionated — we toast on success and
 * failure here so every call site doesn't have to repeat itself. Pass
 * `silent: true` if a caller wants its own toast strategy.
 */
export function useCancelSyncJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => cancelSyncJob(jobId),
    onSuccess: () => {
      toast.success("Sync job cancelled");
      queryClient.invalidateQueries({ queryKey: queryKeys.syncJobs.all });
    },
    onError: (error) => {
      logger.error("Error cancelling sync job", error);
      toast.error("Failed to cancel sync job");
    },
  });
}
