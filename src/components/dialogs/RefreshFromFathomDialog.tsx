/**
 * RefreshFromFathomDialog — Phase 40 Fathom Re-import / Overwrite.
 *
 * Confirmation dialog before triggering a destructive overwrite of
 * title/transcript/summary/duration. Locked copy from 40-CONTEXT.md.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RiLoader4Line, RiRefreshLine } from '@remixicon/react';

interface RefreshFromFathomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  callTitle?: string;
}

export function RefreshFromFathomDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  callTitle,
}: RefreshFromFathomDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent
        className="max-w-md"
        data-testid="refresh-from-fathom-dialog"
      >
        <DialogHeader>
          <DialogTitle>Refresh from Fathom?</DialogTitle>
          <DialogDescription>
            Refresh title, transcript, summary, and duration from Fathom?
            Tags, folder, and workspace assignments are preserved.
            {callTitle && (
              <span className="block mt-2 text-xs text-muted-foreground/80">
                Call: <span className="font-medium text-foreground">{callTitle}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="hollow"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
            data-testid="refresh-from-fathom-confirm"
          >
            {isPending ? (
              <>
                <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RiRefreshLine className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
