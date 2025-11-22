import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ResyncConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editedCount: number;
  deletedCount: number;
  onConfirm: () => void;
}

export function ResyncConfirmDialog({
  open,
  onOpenChange,
  editedCount,
  deletedCount,
  onConfirm,
}: ResyncConfirmDialogProps) {
  const hasChanges = editedCount > 0 || deletedCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resync from Fathom?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will restore the original transcript from Fathom, removing any edits
              or deletions you've made to this call.
            </p>
            {hasChanges && (
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="font-medium text-foreground">Changes that will be lost:</p>
                {editedCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    • {editedCount} edited segment{editedCount !== 1 ? "s" : ""}
                  </p>
                )}
                {deletedCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    • {deletedCount} hidden segment{deletedCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
            <p className="text-destructive font-medium">This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, restore original
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
