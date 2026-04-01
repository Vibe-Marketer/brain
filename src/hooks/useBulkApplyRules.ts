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
  // Field names match the edge function response exactly
  total_evaluated: number;
  matched: number;
  moved: number;
  skipped: number;
  dry_run: boolean;
  matches: Array<{
    recording_id: string;
    title: string;
    rule_id: string;
    rule_name: string;
    target_workspace_id: string;
    target_workspace_name: string | null;
    target_folder_id: string | null;
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
      if (result.dry_run) {
        if (result.matched === 0) {
          toast.info('No existing calls match current rules');
        } else {
          const ruleNames = new Set(result.matches.map(d => d.rule_name));
          toast.success(
            `${result.matched} call${result.matched !== 1 ? 's' : ''} would be routed by ${ruleNames.size} rule${ruleNames.size !== 1 ? 's' : ''}`
          );
        }
      } else {
        if (result.moved === 0) {
          toast.info(result.matched > 0
            ? `${result.matched} calls matched but could not be moved`
            : 'No existing calls matched the current rules'
          );
        } else {
          toast.success(`Moved ${result.moved} call${result.moved !== 1 ? 's' : ''} to their target workspaces`);
        }
      }
    },
    onError: (error) => {
      toast.error(`Bulk apply failed: ${error.message}`);
    },
  });
}
