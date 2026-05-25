/**
 * useImportSources — TanStack Query hooks for import source management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-config';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgContext } from '@/hooks/useOrgContext';
import {
  getImportSources,
  getImportCounts,
  toggleSourceActive,
  uploadFile,
  disconnectImportSource,
  getFailedImports,
  retryFailedImport,
  clearFailedImports,
} from '@/services/import-sources.service';
import type { ImportSource, FailedImport } from '@/services/import-sources.service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches all connected import sources for the authenticated user.
 */
export function useImportSources() {
  const { user } = useAuth();

  return useQuery<ImportSource[]>({
    queryKey: queryKeys.imports.sources(),
    queryFn: getImportSources,
    enabled: !!user,
  });
}

/**
 * Fetches call counts per source_app for the current org.
 * Scoped to activeOrgId so counts only reflect calls in the active org (ORG-01).
 */
export function useImportCounts() {
  const { user } = useAuth();
  const { activeOrgId } = useOrgContext();

  return useQuery<Record<string, number>>({
    queryKey: [...queryKeys.imports.counts(), activeOrgId],
    queryFn: () => getImportCounts(activeOrgId!),
    enabled: !!user && !!activeOrgId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Fetches failed imports from sync_jobs, scoped to the active org.
 */
export function useFailedImports() {
  const { user } = useAuth();
  const { activeOrgId } = useOrgContext();

  return useQuery<FailedImport[]>({
    queryKey: [...queryKeys.imports.failed(), activeOrgId],
    queryFn: () => getFailedImports(activeOrgId!),
    enabled: !!user && !!activeOrgId,
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Toggles a source active/inactive.
 */
export function useToggleSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceId, isActive }: { sourceId: string; isActive: boolean }) =>
      toggleSourceActive(sourceId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update source');
    },
  });
}

/**
 * Uploads a file for Whisper transcription.
 */
export function useFileUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadFile(file),
    onSuccess: (_data, file) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.counts() });
      toast.success(`Transcription complete — ${file.name}`);
    },
    onError: (error: Error, file) => {
      toast.error(`Upload failed for ${file.name}: ${error.message}`);
    },
  });
}

/**
 * Disconnects an import source.
 */
export function useDisconnectSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => disconnectImportSource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
      toast.success('Source disconnected');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to disconnect source');
    },
  });
}

/**
 * Retries a single failed import.
 */
export function useRetryFailedImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceApp,
      failedExternalId,
    }: {
      sourceApp: string;
      failedExternalId: string;
    }) => retryFailedImport(sourceApp, failedExternalId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.failed() });
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
        toast.success('Retry started');
      } else {
        toast.error(result.error ?? 'Retry failed');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to retry import');
    },
  });
}

export function useClearFailedImports() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      syncJobId?: string;
      failedExternalIds?: string[];
      clearAll?: boolean;
    }) => clearFailedImports(input),
    onSuccess: (result, variables) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to clear failed imports');
        return;
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.imports.failed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
      toast.success(
        variables.clearAll
          ? 'Cleared all failed imports'
          : `Cleared ${result.clearedCount ?? 0} failed import(s)`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to clear failed imports');
    },
  });
}
