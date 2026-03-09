/**
 * useBulkApplyRules — mutation hook for retroactively applying routing rules.
 */

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bulkApplyRoutingRules } from '@/services/bulk-apply-rules.service';
import type { BulkApplyOptions, BulkApplyResult } from '@/services/bulk-apply-rules.service';

export function useBulkApplyRules() {
  return useMutation<BulkApplyResult, Error, BulkApplyOptions>({
    mutationFn: bulkApplyRoutingRules,
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
