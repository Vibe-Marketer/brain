import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

/**
 * Kill-switch mutation. `value` is the raw kill_switch flag: true = engaged
 * (autopilot PAUSED), false = released (autopilot ON). Toasts are framed in
 * autopilot terms — the operator thinks "on/off", not "kill switch".
 */
export function useSetKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setKillSwitch(value),
    onSuccess: (_data, value) => {
      if (value) {
        // kill_switch engaged -> autopilot paused
        toast.warning("Autopilot paused", {
          description: "The runner stops claiming tickets within one poll cycle (~5 min). Anything mid-fix finishes.",
        });
      } else {
        // kill_switch released -> autopilot armed
        toast.success("Autopilot armed", {
          description: "The runner claims its first ticket on the next check (~5 min). Each fix still waits for your approval.",
        });
      }
    },
    onError: (err) => {
      toast.error("Couldn't change autopilot", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runner() });
    },
  });
}
