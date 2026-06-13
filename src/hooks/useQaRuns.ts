import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchQaRuns,
  fetchLatestQaRun,
  requestQaRun,
  fetchQaFindingSummary,
  fetchQaFindings,
  type QaFindingLane,
} from "@/services/qa.service";
import { queryKeys } from "@/lib/query-config";

export function useQaRuns(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.admin.qaRuns(), limit] as const,
    queryFn: () => fetchQaRuns(limit),
  });
}

export function useRequestQaRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestQaRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.qaRuns() });
      toast.success("Scan started — the runner picks it up within about a minute. Results show here when it finishes.");
    },
    onError: (error: Error) => {
      toast.error(`Could not queue scan: ${error.message}`);
    },
  });
}

export function useLatestQaRun() {
  return useQuery({
    queryKey: [...queryKeys.admin.qaRuns(), "latest"] as const,
    queryFn: fetchLatestQaRun,
  });
}

/**
 * Per-lane QA finding counts plus the latest review-lane rows. Backs the
 * audit/triage block in the admin QA section (read-only).
 */
export function useQaFindingSummary() {
  return useQuery({
    queryKey: queryKeys.admin.qaFindingSummary(),
    queryFn: () => fetchQaFindingSummary(),
  });
}

/** Latest QA findings in a single lane (read-only). */
export function useQaFindings(lane: QaFindingLane, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.admin.qaFindings(lane), limit ?? null] as const,
    queryFn: () => fetchQaFindings({ lane, limit }),
  });
}
