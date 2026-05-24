/**
 * AddImportSourceDialog
 *
 * Triggered by the "+" button on ImportSourcePane. Lets the user pick a
 * source to add. Tiles are rendered from `SOURCE_REGISTRY` in
 * `src/config/source-registry.ts` — adding a new source = adding one
 * registry entry, no edits to this file required.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SOURCE_REGISTRY, type SourceId } from "@/config/source-registry";

export type AddImportSourceChoice = SourceId;

export interface AddImportSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: AddImportSourceChoice) => void;
}

export function AddImportSourceDialog({
  open,
  onOpenChange,
  onSelect,
}: AddImportSourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">
          Add Import Source
        </DialogTitle>
        <DialogDescription>
          Pick where your calls or transcripts will come from.
        </DialogDescription>

        <div className="grid grid-cols-1 gap-2 mt-4">
          {SOURCE_REGISTRY.map(({ id, label, subtitle, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelect(id);
                onOpenChange(false);
              }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg text-left",
                "border border-border bg-card",
                "hover:bg-muted/60 hover:border-foreground/20 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-vibe-orange/40",
              )}
            >
              <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-muted">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddImportSourceDialog;
