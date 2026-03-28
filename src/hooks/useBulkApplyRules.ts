/**
 * useBulkApplyRules — mutation hook for retroactively applying routing rules.
 */

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BulkApplyOptions {
  organizationId: string;
  dryRun?: boolean;
}

interface BulkApplyResult {
  processed: number;
  matched: number;
  assigned: number;
  skipped: number;
  dryRun: boolean;
  details: Array<{
    recordingId: string;
    title: string;
    matchedRuleId: string;
    matchedRuleName: string;
    workspaceId: string;
    folderId: string | null;
    action: 'assigned' | 'skipped';
  }>;
}

export function useBulkApplyRules() {
  return useMutation<BulkApplyResult, Error, BulkApplyOptions>({
    mutationFn: async (opts: BulkApplyOptions) => {
      const { data, error } = await supabase.functions.invoke('apply-routing-rules', {
        body: {
          organization_id: opts.organizationId,
          dry_run: opts.dryRun ?? false,
        },
      });

      if (error) {
        // FunctionsHttpError contains the response body with the actual error message
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(message === 'non-2xx' ? 'Routing rules apply failed — check function logs' : message);
      }
      if (data?.error) throw new Error(data.error);

      return data as BulkApplyResult;
    },
    onSuccess: (result) => {
      if (result.dryRun) {
        if (result.matched === 0) {
          toast.info('Dry run complete — no existing calls match current rules');
        } else {
          toast.success(
            `Dry run: ${result.matched} call${result.matched !== 1 ? 's' : ''} would be routed across ${new Set(result.details.map(d => d.matchedRuleName)).size} rule${result.matched !== 1 ? 's' : ''}`
          );
        }
      } else {
        if (result.assigned === 0) {
          toast.info(result.skipped > 0
            ? `${result.skipped} call${result.skipped !== 1 ? 's' : ''} already assigned — nothing new to route`
            : 'No existing calls matched the current rules'
          );
        } else {
          toast.success(
            `Bulk applied: ${result.assigned} call${result.assigned !== 1 ? 's' : ''} routed${result.skipped > 0 ? `, ${result.skipped} already assigned` : ''}`
          );
        }
      }
    },
    onError: (error) => {
      toast.error(`Bulk apply failed: ${error.message}`);
    },
  });
}
