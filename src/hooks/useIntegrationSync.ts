/**
 * useIntegrationSync — TanStack Query bridge for the integrations service.
 *
 * Heavy lifting (Supabase reads + edge-function invocation) lives in
 * `@/services/integrations.service`. This file is just the React adapter:
 *
 *   - `useIntegrationStatuses()` — query mirroring `getIntegrationStatuses`
 *   - `useTriggerSync()`         — mutation wrapping `triggerIntegrationSync`
 *   - `useIntegrationSync()`     — back-compat default returning the shape
 *                                  the nine pre-migration consumers expect.
 *
 * Realtime invalidation is owned by `IntegrationsRealtimeProvider`; there is
 * no per-mount channel subscription here anymore.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSafeUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { invalidateCallListCaches, queryKeys } from "@/lib/query-config";
import { getIntegrationPlatformConfig } from "@/lib/integration-platforms";
import {
  LegacySourceLessSyncError,
  getIntegrationStatuses,
  triggerIntegrationSync,
  type IntegrationPlatform,
  type IntegrationStatus,
} from "@/services/integrations.service";

export type { IntegrationPlatform, IntegrationStatus };

export function useIntegrationStatuses() {
  return useQuery<IntegrationStatus[]>({
    queryKey: queryKeys.integrations.all(),
    queryFn: async () => {
      const { user, error } = await getSafeUser();
      if (error || !user) return [];
      return getIntegrationStatuses(user.id);
    },
    staleTime: 30_000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      platform: IntegrationPlatform;
      sourceId: string | null;
    }) => {
      await triggerIntegrationSync(params.platform, params.sourceId);
      return params.platform;
    },
    onSuccess: (platform) => {
      invalidateCallListCaches(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.counts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.failed() });
      toast.success(`${getIntegrationPlatformConfig(platform).label} sync triggered`);
    },
    onError: (err, params) => {
      if (err instanceof LegacySourceLessSyncError) {
        toast.info("Use the date picker above to fetch Fathom meetings");
        return;
      }
      logger.error(`Manual sync failed for ${params.platform}`, err);
      toast.error(`Failed to trigger ${params.platform} sync`);
    },
  });
}

interface UseIntegrationSyncReturn {
  integrations: IntegrationStatus[];
  isLoading: boolean;
  error: string | null;
  refreshIntegrations: () => Promise<void>;
  triggerManualSync: (platform: IntegrationPlatform) => Promise<void>;
}

/** Back-compat default: same shape the existing nine consumers depend on. */
export function useIntegrationSync(): UseIntegrationSyncReturn {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useIntegrationStatuses();
  const triggerSync = useTriggerSync();

  const integrations: IntegrationStatus[] = (data ?? []).map((item) =>
    triggerSync.isPending && triggerSync.variables?.platform === item.platform
      ? { ...item, syncStatus: "syncing" }
      : item,
  );

  const refreshIntegrations = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.integrations.all(),
    });
    await refetch();
  }, [queryClient, refetch]);

  const triggerManualSync = useCallback(
    async (platform: IntegrationPlatform) => {
      const target = integrations.find((i) => i.platform === platform);
      await triggerSync.mutateAsync({
        platform,
        sourceId: target?.sourceId ?? null,
      });
    },
    [integrations, triggerSync],
  );

  return {
    integrations,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refreshIntegrations,
    triggerManualSync,
  };
}
