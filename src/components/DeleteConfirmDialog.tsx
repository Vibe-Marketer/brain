import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RiAlertLine, RiDeleteBin6Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";

export type DeleteMode = 'remove-from-workspace' | 'permanent-delete' | 'permanent-last-workspace';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  mode: DeleteMode;
  itemCount: number;
  workspaceName?: string;
  sourceLabels?: string[];
  lastWorkspaceCount?: number;
}

const CONTENT: Record<DeleteMode, {
  title: string;
  destructive: boolean;
  buttonLabel: string;
}> = {
  'remove-from-workspace': {
    title: 'Remove from Hub',
    destructive: false,
    buttonLabel: 'Remove',
  },
  'permanent-last-workspace': {
    title: 'Delete Permanently',
    destructive: true,
    buttonLabel: 'Delete Permanently',
  },
  'permanent-delete': {
    title: 'Delete Permanently',
    destructive: true,
    buttonLabel: 'Delete Permanently',
  },
};

function formatSourceLabels(labels?: string[]): string {
  if (!labels || labels.length === 0) return '';
  const unique = [...new Set(labels)];
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} or ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')}, or ${unique[unique.length - 1]}`;
}

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  itemCount,
  workspaceName,
  sourceLabels,
  lastWorkspaceCount,
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const config = CONTENT[mode];
  const plural = itemCount > 1;
  const sourceText = formatSourceLabels(sourceLabels);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className={`flex items-center gap-2 mb-2 ${config.destructive ? 'text-destructive' : 'text-foreground'}`}>
            {config.destructive ? (
              <RiAlertLine className="h-5 w-5" />
            ) : (
              <RiDeleteBin6Line className="h-5 w-5" />
            )}
            <AlertDialogTitle>{config.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-2" asChild>
            <div>
              {mode === 'remove-from-workspace' && (
                <>
                  <p className="text-foreground">
                    Remove <strong>{itemCount} item{plural ? 's' : ''}</strong> from{' '}
                    <strong>{workspaceName || 'this hub'}</strong>?
                    {' '}They'll remain in your other hubs.
                  </p>
                  {lastWorkspaceCount != null && lastWorkspaceCount > 0 && (
                    <p className="text-sm text-destructive">
                      {lastWorkspaceCount} of these {lastWorkspaceCount === 1 ? 'is' : 'are'} only
                      in this hub and will be permanently deleted.
                    </p>
                  )}
                </>
              )}

              {mode === 'permanent-last-workspace' && (
                <>
                  <p className="text-foreground">
                    This is the only hub for{' '}
                    <strong>{itemCount} item{plural ? 's' : ''}</strong>.
                    Removing will permanently delete {plural ? 'them' : 'it'}.
                  </p>
                  {sourceText && (
                    <p className="text-sm text-muted-foreground">
                      You can re-import from {sourceText} in the future.
                    </p>
                  )}
                </>
              )}

              {mode === 'permanent-delete' && (
                <>
                  <p className="text-foreground">
                    Permanently delete{' '}
                    <strong className="text-destructive">{itemCount} item{plural ? 's' : ''}</strong>{' '}
                    from all hubs?
                  </p>
                  {sourceText && (
                    <p className="text-sm text-muted-foreground">
                      You can re-import from {sourceText} in the future.
                    </p>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={config.destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {config.buttonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
