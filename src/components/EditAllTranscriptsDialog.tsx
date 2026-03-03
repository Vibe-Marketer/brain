import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as RemixIcon from "@remixicon/react";
import { IconPickerInline, getIconById } from "@/components/ui/icon-picker-inline";
import type { AllTranscriptsSettings } from "@/hooks/useAllTranscriptsSettings";

interface EditAllTranscriptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AllTranscriptsSettings;
  onSave: (settings: Partial<AllTranscriptsSettings>) => void;
  onReset: () => void;
  defaultSettings: AllTranscriptsSettings;
}

export default function EditAllTranscriptsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  onReset,
  defaultSettings,
}: EditAllTranscriptsDialogProps) {
  const [name, setName] = useState(settings.name);
  const [icon, setIcon] = useState(settings.icon);

  // Update form when settings change
  useEffect(() => {
    if (open) {
      setName(settings.name);
      setIcon(settings.icon);
    }
  }, [open, settings]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name cannot be empty");
      return;
    }

    onSave({ name: trimmedName, icon });
    toast.success("Settings saved");
    onOpenChange(false);
  };

  const handleReset = () => {
    setName(defaultSettings.name);
    setIcon(defaultSettings.icon);
    onReset();
    toast.success("Reset to defaults");
    onOpenChange(false);
  };

  // Use shared utilities from icon-picker-inline
  const IconComponent = getIconById(icon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Home</DialogTitle>
          <DialogDescription>
            Personalize the name and icon for your main transcript view
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="all-transcripts-name">Display Name</Label>
            <Input
              id="all-transcripts-name"
              placeholder="e.g., Home, My Calls, Library"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPickerInline
              value={icon}
              onChange={setIcon}
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-cb-card">
              {IconComponent ? (
                <IconComponent
                  className="h-5 w-5 text-ink-muted"
                />
              ) : (
                <RemixIcon.RiFileTextLine
                  className="h-5 w-5 text-ink-muted"
                />
              )}
              <span className="font-medium">
                {name || "Home"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="hollow" onClick={handleReset} className="mr-auto">
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="hollow" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
