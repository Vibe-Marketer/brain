/**
 * useFathomRefresh — Phase 40 Fathom Re-import / Overwrite.
 *
 * Calls the `fathom-refresh` edge function for a single recording UUID.
 * Maps server error codes to user-facing Sonner toasts. Invalidates
 * TanStack Query keys on success so the call detail + lists pick up
 * the fresh title/transcript/summary/duration.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-config';
import { logger } from '@/lib/logger';

export interface FathomRefreshResult {
  success: true;
  recording_id: string;
  legacy_recording_id: number;
  title: string;
  duration: number | null;
  synced_at: string;
}

interface FathomRefreshError {
  code: string;
  status: number;
  message: string;
}

async function invokeFathomRefresh(recordingId: string): Promise<FathomRefreshResult> {
  const { data, error } = await supabase.functions.invoke<FathomRefreshResult | { error: string }>(
    'fathom-refresh',
    { body: { recording_id: recordingId } },
  );

  if (error) {
    // supabase-js FunctionsHttpError exposes context as a Response in current
    // clients; older call sites may wrap it as context.response.
    // We treat any non-200 as an error and parse the body for our error code.
    const ctx = (error as unknown as { context?: Response | { response?: Response } }).context;
    const response = ctx instanceof Response ? ctx : ctx?.response;
    let status = 500;
    let code = 'INTERNAL';
    if (response) {
      status = response.status;
      try {
        const body = (await response.clone().json()) as { error?: string };
        if (body?.error) code = body.error;
      } catch {
        // body wasn't JSON — leave code as INTERNAL
      }
    }
    const err: FathomRefreshError = { code, status, message: error.message };
    throw err;
  }

  if (data && 'error' in data) {
    const err: FathomRefreshError = {
      code: data.error,
      status: 500,
      message: data.error,
    };
    throw err;
  }

  return data as FathomRefreshResult;
}

interface UseFathomRefreshOptions {
  /** Called after a successful refresh, before the mutation settles. */
  onSuccess?: (result: FathomRefreshResult) => void;
  /** Called after the mutation settles (success OR error) — useful for closing modals. */
  onSettled?: () => void;
}

export function useFathomRefresh(options: UseFathomRefreshOptions = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<FathomRefreshResult, FathomRefreshError, string>({
    mutationKey: ['fathom-refresh'],
    mutationFn: invokeFathomRefresh,
    onSuccess: (result) => {
      logger.info('[fathom-refresh] success', {
        recording_id: result.recording_id,
        title: result.title,
      });
      toast.success('Refreshed from Fathom — title, transcript, and summary updated.');

      // Invalidate every key that displays this recording.
      void queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(result.recording_id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calls.transcripts(result.recording_id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calls.speakers(result.recording_id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
      void queryClient.invalidateQueries({ queryKey: ['raw-call-data', result.recording_id] });
      options.onSuccess?.(result);
    },
    onError: (err) => {
      logger.warn('[fathom-refresh] failed', { code: err.code, status: err.status });
      switch (err.code) {
        case 'Unauthorized':
        case 'No authorization header':
        case 'Invalid authorization header format':
        case 'UNAUTHORIZED':
          toast.error('Your CallVault session expired. Sign in again, then refresh.');
          break;
        case 'FATHOM_CALL_NOT_FOUND':
          toast.error('Fathom could not find this call through its API. Open the Fathom link to confirm access, then reconnect Fathom if it still opens.');
          break;
        case 'FATHOM_AUTH_EXPIRED':
          toast.error('Your Fathom connection expired. Reconnect in Settings → Integrations.', {
            action: {
              label: 'Reconnect',
              onClick: () => navigate('/settings/integrations'),
            },
          });
          break;
        case 'FATHOM_RATE_LIMITED':
          toast.error('Fathom is rate-limiting us right now. Try again in a minute.');
          break;
        case 'NOT_A_FATHOM_CALL':
          toast.error("This isn't a Fathom call — refresh isn't available.");
          break;
        case 'NO_FATHOM_SOURCE':
          toast.error('No active Fathom connection found. Connect one in Settings → Integrations.');
          break;
        case 'RECORDING_NOT_FOUND':
          toast.error("Couldn't find that recording — please refresh the page and try again.");
          break;
        case 'FATHOM_NO_LEGACY_ID':
          toast.error('This Fathom recording is missing its provider ID, so it cannot be refreshed.');
          break;
        case 'BAD_REQUEST':
          toast.error('Refresh needs a CallVault recording UUID.');
          break;
        case 'INTERNAL':
          toast.error('Fathom refresh hit a server error. Try again, then contact support if it repeats.');
          break;
        default:
          toast.error(`Couldn't refresh from Fathom: ${err.code || err.message}`);
      }
    },
    onSettled: () => {
      options.onSettled?.();
    },
  });
}
