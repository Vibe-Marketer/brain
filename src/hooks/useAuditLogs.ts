import { useQuery } from "@tanstack/react-query";
import {
  fetchAuditLogs,
  fetchAuditActions,
  type AuditLogFilters,
} from "@/services/admin-audit.service";
import { queryKeys } from "@/lib/query-config";

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: queryKeys.admin.audit(filters as Record<string, unknown> | undefined),
    queryFn: () => fetchAuditLogs(filters),
  });
}

/** Distinct action names (both sources) for the audit filter dropdown. */
export function useAuditActions() {
  return useQuery({
    queryKey: [...queryKeys.admin.all, "audit", "actions"] as const,
    queryFn: fetchAuditActions,
  });
}
