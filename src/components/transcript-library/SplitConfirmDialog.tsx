import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RiSplitCellsHorizontal } from "@remixicon/react";

interface SplitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function SplitConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: SplitConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RiSplitCellsHorizontal className="h-5 w-5" />
            Split recording here?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This will create two separate recordings from this call:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>
                  <strong className="text-foreground">Part 1</strong> — all segments before this point
                </li>
                <li>
                  <strong className="text-foreground">Part 2</strong> — this segment and everything after
                </li>
              </ul>
              <p>
                Both recordings will keep the original title with <em>(Part 1)</em> and <em>(Part 2)</em>{" "}
                appended. You can rename them after. Their summaries will be cleared — you can
                regenerate each one after the split.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {isPending ? "Splitting…" : "Split recording"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
