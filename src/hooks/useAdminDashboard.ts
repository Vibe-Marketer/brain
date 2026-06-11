import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardStats,
  needsYouQueue,
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
