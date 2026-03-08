/**
 * BulkApplyDialog — Preview and confirm bulk-applying routing rules to existing recordings.
 *
 * Flow:
 * 1. Opens with a dry-run fetch to show what would change
 * 2. User reviews the preview
 * 3. Confirm button executes the actual apply
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RiRouteLine, RiCheckLine } from '@remixicon/react';
import { useBulkApplyRules } from '@/hooks/useRoutingRules';
import type { BulkApplyResult } from '@/types/routing';

export interface BulkApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkApplyDialog({ open, onOpenChange }: BulkApplyDialogProps) {
  const [preview, setPreview] = useState<BulkApplyResult | null>(null);
  const [applied, setApplied] = useState(false);
  const bulkApply = useBulkApplyRules();

  // Fetch dry-run preview when dialog opens
  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setApplied(false);
    bulkApply.mutate(
      { dryRun: true },
      {
        onSuccess: (data) => setPreview(data),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleApply = useCallback(() => {
    bulkApply.mutate(
      { dryRun: false },
      {
        onSuccess: (data) => {
          setPreview(data);
          setApplied(true);
        },
      },
    );
  }, [bulkApply]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const isLoading = bulkApply.isPending && !preview;
  const isApplying = bulkApply.isPending && !!preview && !applied;
  const hasMatches = (preview?.matched ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="bulk-apply-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {applied ? (
                <RiCheckLine className="h-4 w-4 text-emerald-500" />
              ) : (
                <RiRouteLine className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <DialogTitle>
              {applied ? 'Rules Applied' : 'Apply Rules to Existing Calls'}
            </DialogTitle>
          </div>
          <DialogDescription id="bulk-apply-description">
            {applied
              ? 'Routing rules have been applied to your existing recordings.'
              : 'Preview which recordings will be moved by your active routing rules.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg border border-border/40 bg-muted/30 animate-pulse"
                />
              ))}
              <p className="text-xs text-muted-foreground text-center mt-3">
                Evaluating rules against existing recordings...
              </p>
            </div>
          )}

          {/* Preview results */}
          {preview && !isLoading && (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {preview.total_evaluated}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    Evaluated
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {preview.matched}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    Matched
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {applied ? preview.moved : preview.skipped}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    {applied ? 'Moved' : 'No Match'}
                  </p>
                </div>
              </div>

              {/* Match list */}
              {hasMatches && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground/60">
                        <th className="px-3 py-2 font-medium">Recording</th>
                        <th className="px-3 py-2 font-medium">Rule</th>
                        <th className="px-3 py-2 font-medium">Destination</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {preview.matches.map((match) => (
                        <tr key={match.recording_id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 truncate max-w-[160px]" title={match.title}>
                            {match.title}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]" title={match.rule_name}>
                            {match.rule_name}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]" title={match.target_workspace_name ?? undefined}>
                            {match.target_workspace_name ?? 'Unknown'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* No matches */}
              {!hasMatches && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">
                    No unrouted recordings match your current rules.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Recordings that were already routed during import are excluded.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {applied ? (
            <Button variant="default" onClick={handleClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="hollow" onClick={handleClose} disabled={isApplying}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleApply}
                disabled={!hasMatches || isApplying || isLoading}
              >
                {isApplying
                  ? 'Applying...'
                  : `Move ${preview?.matched ?? 0} recording${(preview?.matched ?? 0) !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
