/**
 * useBulkApplyRules — mutation hook for retroactively applying routing rules.
 */

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BulkApplyOptions {
  dryRun?: boolean;
  ruleIds?: string[];
  limit?: number;
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated — please sign in and try again.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/bulk-apply-routing-rules`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
          body: JSON.stringify({
            dryRun: opts.dryRun ?? false,
            ruleIds: opts.ruleIds,
            limit: opts.limit ?? 1000,
          }),
        }
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (payload as Record<string, string>)?.error ?? (payload as Record<string, string>)?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      if ((payload as Record<string, string>)?.error) throw new Error((payload as Record<string, string>).error);

      return payload as BulkApplyResult;
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
