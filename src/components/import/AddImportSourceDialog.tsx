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
import { SelectionButton } from "@/components/ui/selection-button";
import { StatusBadge } from "@/components/ui/status-badge";
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
          {SOURCE_REGISTRY.map(({ id, label, subtitle, icon: Icon, status }) => (
            <SelectionButton
              key={id}
              selected={false}
              onClick={() => {
                onSelect(id);
                onOpenChange(false);
              }}
              icon={
                <Icon className="h-4 w-4 text-foreground" />
              }
              label={label}
              description={subtitle}
              rightSlot={status === "beta" ? <StatusBadge variant="beta" /> : undefined}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddImportSourceDialog;
