import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type DeleteMode = 'remove-from-workspace' | 'permanent-delete';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (effectiveMode: DeleteMode) => void;
  mode: DeleteMode;
  itemCount: number;
  workspaceName?: string;
  sourceLabels?: string[];
}

const CONTENT: Record<DeleteMode, {
  title: string;
  destructive: boolean;
  buttonLabel: string;
}> = {
  'remove-from-workspace': {
    title: 'Remove from Workspace',
    destructive: false,
    buttonLabel: 'Remove',
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
}: DeleteConfirmDialogProps) {
  const [permanentDelete, setPermanentDelete] = useState(false);

  useEffect(() => {
    if (!open) setPermanentDelete(false);
  }, [open]);

  const effectiveMode: DeleteMode =
    mode === 'remove-from-workspace' && permanentDelete ? 'permanent-delete' : mode;

  const handleConfirm = () => {
    onConfirm(effectiveMode);
    onOpenChange(false);
  };

  const config = CONTENT[effectiveMode];
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
                    <strong>{workspaceName || 'this workspace'}</strong>?
                    {' '}They'll still appear in Home.
                  </p>
                  <div className="flex items-start gap-2.5 pt-3 mt-1 border-t border-border">
                    <Checkbox
                      id="permanent-delete-checkbox"
                      checked={permanentDelete}
                      onCheckedChange={(checked) => setPermanentDelete(checked === true)}
                      className={permanentDelete ? "mt-0.5 border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive" : "mt-0.5"}
                    />
                    <Label htmlFor="permanent-delete-checkbox" className="cursor-pointer leading-none">
                      <span className={`text-sm font-medium ${permanentDelete ? 'text-destructive' : 'text-foreground'}`}>
                        Permanently delete
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Removes from all workspaces — cannot be undone
                      </span>
                    </Label>
                  </div>
                </>
              )}

              {mode === 'permanent-delete' && (
                <>
                  <p className="text-foreground">
                    Permanently delete{' '}
                    <strong className="text-destructive">{itemCount} item{plural ? 's' : ''}</strong>{' '}
                    from all workspaces?
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
