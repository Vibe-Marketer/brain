import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { tagSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

interface QuickCreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagCreated?: (tagId: string) => void;
}

export default function QuickCreateTagDialog({
  open,
  onOpenChange,
  onTagCreated,
}: QuickCreateTagDialogProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    // Validate input
    const validation = tagSchema.safeParse({ name: name.trim() });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid tag name");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create tags");
        return;
      }

      const { data, error } = await supabase
        .from("call_tags")
        .insert({
          name: validation.data.name,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Tag created successfully");
      onTagCreated?.(data.id);
      onOpenChange(false);
      setName("");
    } catch (error) {
      logger.error("Error creating tag", error);
      toast.error("Failed to create tag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Tag</DialogTitle>
          <DialogDescription>
            Add a new tag to classify your meeting calls
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Tag Name</Label>
            <Input
              id="tag-name"
              placeholder="e.g., Team Calls, Client Meetings"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) {
                  handleCreate();
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
