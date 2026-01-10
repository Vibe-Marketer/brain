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
  RiLoader4Line,
  RiSettings4Line,
  RiDragMoveLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";

type DedupPriorityMode = "first_synced" | "most_recent" | "platform_hierarchy" | "longest_transcript";

interface SourcePriorityModalProps {
  open: boolean;
  onComplete: () => void;
  onDismiss?: () => void;
  /** The platforms that the user has connected */
  connectedPlatforms?: string[];
}

const PRIORITY_MODE_OPTIONS: {
  value: DedupPriorityMode;
  label: string;
  description: string;
}[] = [
  {
    value: "first_synced",
    label: "First Synced (Recommended)",
    description: "The first source to sync a meeting becomes the primary. Later duplicates are merged without replacing content.",
  },
  {
    value: "most_recent",
    label: "Most Recent",
    description: "The most recently synced version of a meeting becomes the primary. Updates replace earlier versions.",
  },
  {
    value: "platform_hierarchy",
    label: "Platform Preference",
    description: "You choose which platform takes priority. Drag to reorder platforms below.",
  },
  {
    value: "longest_transcript",
    label: "Best Quality",
    description: "The source with the longest/most complete transcript becomes the primary.",
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  fathom: "Fathom",
  google_meet: "Google Meet",
  zoom: "Zoom",
};

export default function SourcePriorityModal({
  open,
  onComplete,
  onDismiss,
  connectedPlatforms = ["fathom", "google_meet"],
}: SourcePriorityModalProps) {
  const [priorityMode, setPriorityMode] = useState<DedupPriorityMode>("first_synced");
  const [platformOrder, setPlatformOrder] = useState<string[]>(connectedPlatforms);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing preferences on mount
  useEffect(() => {
    if (open) {
      loadPreferences();
    }
  }, [open]);

  // Update platform order when connected platforms change
  useEffect(() => {
    setPlatformOrder((prev) => {
      // Keep existing order for platforms that are still connected
      const existing = prev.filter((p) => connectedPlatforms.includes(p));
      // Add any new platforms at the end
      const newPlatforms = connectedPlatforms.filter((p) => !prev.includes(p));
      return [...existing, ...newPlatforms];
    });
  }, [connectedPlatforms]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("dedup_priority_mode, dedup_platform_order")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings) {
        if (settings.dedup_priority_mode) {
          setPriorityMode(settings.dedup_priority_mode as DedupPriorityMode);
        }
        if (settings.dedup_platform_order && settings.dedup_platform_order.length > 0) {
          setPlatformOrder(settings.dedup_platform_order);
        }
      }
    } catch (error) {
      logger.error("Error loading dedup preferences", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const { user, error: authError } = await getSafeUser();

      if (authError || !user) {
        toast.error("Not authenticated");
        return false;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            dedup_priority_mode: priorityMode,
            dedup_platform_order: platformOrder,
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        logger.error("Failed to save dedup preferences", error);
        toast.error("Failed to save preferences: " + error.message);
        return false;
      }

      toast.success("Source priority preferences saved");
      return true;
    } catch (error) {
      logger.error("Error saving dedup preferences", error);
      toast.error("Failed to save preferences");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const saved = await savePreferences();
    if (saved) {
      onComplete();
    }
  };

  const movePlatformUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...platformOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setPlatformOrder(newOrder);
  };

  const movePlatformDown = (index: number) => {
    if (index === platformOrder.length - 1) return;
    const newOrder = [...platformOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setPlatformOrder(newOrder);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss?.()} modal>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            <RiSettings4Line className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <DialogTitle className="text-2xl">SOURCE PRIORITY SETTINGS</DialogTitle>
              <DialogDescription className="mt-1">
                You have multiple recording sources connected. Configure how duplicate meetings are handled.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RiLoader4Line className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-6 space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When the same meeting is recorded by multiple platforms (e.g., Fathom and Google Meet),
                which source should be used as the primary record?
              </p>

              <RadioGroup
                value={priorityMode}
                onValueChange={(value) => setPriorityMode(value as DedupPriorityMode)}
                className="space-y-3"
              >
                {PRIORITY_MODE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setPriorityMode(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={option.value} className="font-medium cursor-pointer">
                        {option.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Platform Order (only shown for platform_hierarchy mode) */}
            {priorityMode === "platform_hierarchy" && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <RiDragMoveLine className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Platform Priority Order</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Platforms at the top take priority. Use the arrows to reorder.
                </p>

                <div className="space-y-2">
                  {platformOrder.map((platform, index) => (
                    <div
                      key={platform}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">
                          {index + 1}.
                        </span>
                        <span className="font-medium">
                          {PLATFORM_LABELS[platform] || platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => movePlatformUp(index)}
                          disabled={index === 0}
                          className="h-8 w-8 p-0"
                        >
                          <RiArrowUpLine className="h-4 w-4" />
                          <span className="sr-only">Move up</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => movePlatformDown(index)}
                          disabled={index === platformOrder.length - 1}
                          className="h-8 w-8 p-0"
                        >
                          <RiArrowDownLine className="h-4 w-4" />
                          <span className="sr-only">Move down</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Duplicate detection uses meeting title, time, and participants.
                Only meetings synced after changing this setting will use the new priority.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-6 border-t">
          <div className="flex items-center justify-between w-full">
            {onDismiss && (
              <Button variant="hollow" onClick={onDismiss} disabled={saving}>
                Skip for Now
              </Button>
            )}
            <div className="flex-1" />
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
