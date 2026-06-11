import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboardStats,
  getRunnerState,
  needsYouQueue,
  setKillSwitch,
} from "@/services/admin-dashboard.service";
import { queryKeys } from "@/lib/query-config";

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: fetchDashboardStats,
    // The dashboard is a health surface — keep it reasonably fresh.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNeedsYou() {
  return useQuery({
    queryKey: queryKeys.admin.needsYou(),
    queryFn: needsYouQueue,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Live runner_state read for the /admin runner card (14-02). */
export function useRunnerState() {
  return useQuery({
    queryKey: queryKeys.admin.runner(),
    queryFn: getRunnerState,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Kill-switch mutation — invalidates the runner card on settle. */
export function useSetKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setKillSwitch(value),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runner() });
    },
  });
}
