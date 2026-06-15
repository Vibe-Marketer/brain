import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchDashboardStats,
  fetchRunnerRuns,
  fetchRunnerRunsForTicket,
  getAutopilotTrustMetrics,
  getTicketClassMetrics,
  getRunnerState,
  demoteAutopilotCategory,
  needsYouQueue,
  promoteAutopilotCategory,
  setFixAgent,
  setKillSwitch,
  type AutopilotTrustMutationInput,
  type FixAgentProvider,
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

/** Recent runner_runs ledger rows for the /admin runner card (17-02). */
export function useRunnerRuns(limit = 10) {
  return useQuery({
    queryKey: queryKeys.admin.runnerRuns(),
    queryFn: () => fetchRunnerRuns(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Per-ticket runner_runs ledger rows for ticket detail evidence (17-02). */
export function useRunnerRunsForTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ticketId
      ? queryKeys.admin.runnerRunsForTicket(ticketId)
      : queryKeys.admin.runnerRunsForTicket(""),
    queryFn: () => fetchRunnerRunsForTicket(ticketId ?? ""),
    enabled: Boolean(ticketId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAutopilotTrustMetrics() {
  return useQuery({
    queryKey: queryKeys.admin.autopilotTrustMetrics(),
    queryFn: getAutopilotTrustMetrics,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTicketClassMetrics() {
  return useQuery({
    queryKey: queryKeys.admin.ticketClassMetrics(),
    queryFn: getTicketClassMetrics,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

function invalidateTrustSurfaces(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.autopilotTrustMetrics() });
}

export function usePromoteAutopilotCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AutopilotTrustMutationInput) =>
      promoteAutopilotCategory(input),
    onSuccess: (_data, input) => {
      toast.success("Category promoted", {
        description: `${input.category} now uses explicit auto approval. Push gates still apply.`,
      });
    },
    onError: (err) => {
      toast.error("Couldn't promote category", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    },
    onSettled: () => {
      invalidateTrustSurfaces(queryClient);
    },
  });
}

export function useDemoteAutopilotCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AutopilotTrustMutationInput) =>
      demoteAutopilotCategory(input),
    onSuccess: (_data, input) => {
      toast.warning("Category moved to manual", {
        description: `${input.category} waits for admin approval again.`,
      });
    },
    onError: (err) => {
      toast.error("Couldn't demote category", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    },
    onSettled: () => {
      invalidateTrustSurfaces(queryClient);
    },
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

export function useSetFixAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: FixAgentProvider) => setFixAgent(value),
    onSuccess: (_data, value) => {
      toast.success("Fix agent updated", {
        description:
          value === "claude"
            ? "Claude is primary. Codex remains the rate-limit fallback."
            : "Codex is primary. Claude remains the rate-limit fallback.",
      });
    },
    onError: (err) => {
      toast.error("Couldn't change fix agent", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.runner() });
    },
  });
}
