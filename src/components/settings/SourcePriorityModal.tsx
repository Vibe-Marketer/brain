import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  RiArrowUpLine,
  RiArrowDownLine,
  RiDraggable,
  RiLoader4Line,
  RiShieldCheckLine,
  RiVideoLine,
  RiCheckLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";

export type DedupPriorityMode =
  | "first_synced"
  | "most_recent"
  | "platform_hierarchy"
  | "longest_transcript";

export type Platform = "fathom" | "zoom";

interface SourcePriorityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  /** Initial priority mode, if already set */
  initialMode?: DedupPriorityMode;
  /** Initial platform order, if already set */
  initialPlatformOrder?: Platform[];
}

const PRIORITY_OPTIONS: {
  value: DedupPriorityMode;
  label: string;
  description: string;
}[] = [
  {
    value: "first_synced",
    label: "First Synced",
    description: "Keep the first recording that was synced as the primary source",
  },
  {
    value: "most_recent",
    label: "Most Recent",
    description: "Always use the most recently synced recording as the primary",
  },
  {
    value: "platform_hierarchy",
    label: "Platform Priority",
    description: "Prefer recordings from your chosen platform order (drag to reorder)",
  },
  {
    value: "longest_transcript",
    label: "Longest Transcript",
    description: "Use the recording with the most complete transcript",
  },
];

const PLATFORM_INFO: Record<Platform, { label: string; icon: typeof RiVideoLine }> = {
  fathom: {
    label: "Fathom",
    icon: RiVideoLine,
  },
  zoom: {
    label: "Zoom",
    icon: RiVideoLine,
  },
};

const DEFAULT_PLATFORM_ORDER: Platform[] = ["fathom", "zoom"];

export default function SourcePriorityModal({
  open,
  onOpenChange,
  onComplete,
  initialMode = "first_synced",
  initialPlatformOrder = DEFAULT_PLATFORM_ORDER,
}: SourcePriorityModalProps) {
  const [priorityMode, setPriorityMode] = useState<DedupPriorityMode>(initialMode);
  const [platformOrder, setPlatformOrder] = useState<Platform[]>(initialPlatformOrder);
  const [saving, setSaving] = useState(false);
  const [draggedPlatform, setDraggedPlatform] = useState<Platform | null>(null);

  // Reset state when modal opens with new initial values
  useEffect(() => {
    if (open) {
      setPriorityMode(initialMode);
      setPlatformOrder(initialPlatformOrder);
    }
  }, [open, initialMode, initialPlatformOrder]);

  const movePlatform = (index: number, direction: "up" | "down") => {
    const newOrder = [...platformOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setPlatformOrder(newOrder);
  };

  // Simple drag-and-drop handlers
  const handleDragStart = (platform: Platform) => {
    setDraggedPlatform(platform);
  };

  const handleDragOver = (e: React.DragEvent, targetPlatform: Platform) => {
    e.preventDefault();
    if (!draggedPlatform || draggedPlatform === targetPlatform) return;

    const newOrder = [...platformOrder];
    const draggedIndex = newOrder.indexOf(draggedPlatform);
    const targetIndex = newOrder.indexOf(targetPlatform);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedPlatform);
    setPlatformOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedPlatform(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { user, error: authError } = await getSafeUser();

      if (authError || !user) {
        toast.error("Not authenticated");
        return;
      }

      // Save deduplication preferences to user_settings
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          dedup_priority_mode: priorityMode,
          dedup_platform_order: platformOrder,
        }, {
          onConflict: "user_id"
        });

      if (error) {
        logger.error("Failed to save source priority settings", error);
        toast.error("Failed to save settings: " + error.message);
        return;
      }

      toast.success("Source priority settings saved");
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      logger.error("Error saving source priority settings", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-vibe-orange/10">
              <RiShieldCheckLine className="h-6 w-6 text-vibe-orange" />
            </div>
            <div>
              <DialogTitle className="text-xl">Source Priority Settings</DialogTitle>
              <DialogDescription className="mt-1">
                Configure how duplicate meetings from multiple sources are handled
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Info banner */}
          <div className="p-3 rounded-lg bg-muted/50 border border-cb-border dark:border-cb-border-dark">
            <p className="text-sm text-muted-foreground">
              When the same meeting is synced from both Fathom and Zoom, CallVault will
              automatically detect duplicates and merge them. Choose which source should
              be used as the primary for displaying content.
            </p>
          </div>

          {/* Priority Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Priority Mode</Label>
            <RadioGroup
              value={priorityMode}
              onValueChange={(value) => setPriorityMode(value as DedupPriorityMode)}
              className="space-y-2"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    priorityMode === option.value
                      ? "border-vibe-orange bg-vibe-orange/5"
                      : "border-cb-border dark:border-cb-border-dark hover:bg-muted/30"
                  )}
                  onClick={() => setPriorityMode(option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  {priorityMode === option.value && (
                    <RiCheckLine className="h-4 w-4 text-vibe-orange shrink-0" />
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Platform Hierarchy (only visible when platform_hierarchy is selected) */}
          {priorityMode === "platform_hierarchy" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Platform Order</Label>
              <p className="text-xs text-muted-foreground">
                Drag to reorder or use arrows. Top platform has highest priority.
              </p>
              <div className="space-y-2">
                {platformOrder.map((platform, index) => {
                  const info = PLATFORM_INFO[platform];
                  const Icon = info.icon;

                  return (
                    <div
                      key={platform}
                      draggable
                      onDragStart={() => handleDragStart(platform)}
                      onDragOver={(e) => handleDragOver(e, platform)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        "bg-background cursor-grab active:cursor-grabbing",
                        "transition-all duration-150",
                        draggedPlatform === platform
                          ? "opacity-50 border-vibe-orange"
                          : "border-cb-border dark:border-cb-border-dark hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Drag handle */}
                      <RiDraggable className="h-4 w-4 text-muted-foreground shrink-0" />

                      {/* Priority number */}
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>

                      {/* Platform info */}
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm font-medium">{info.label}</span>

                      {/* Move buttons */}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={index === 0}
                          onClick={() => movePlatform(index, "up")}
                          title="Move up"
                        >
                          <RiArrowUpLine className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={index === platformOrder.length - 1}
                          onClick={() => movePlatform(index, "down")}
                          title="Move down"
                        >
                          <RiArrowDownLine className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
