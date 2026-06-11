import { useQuery } from "@tanstack/react-query";
import { fetchQaRuns, fetchLatestQaRun } from "@/services/qa.service";
import { queryKeys } from "@/lib/query-config";

export function useQaRuns(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.admin.qaRuns(), limit] as const,
    queryFn: () => fetchQaRuns(limit),
  });
}

export function useLatestQaRun() {
  return useQuery({
    queryKey: [...queryKeys.admin.qaRuns(), "latest"] as const,
    queryFn: fetchLatestQaRun,
  });
}
