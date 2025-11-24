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
import { categorySchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

interface QuickCreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryCreated?: (categoryId: string) => void;
}

export default function QuickCreateCategoryDialog({
  open,
  onOpenChange,
  onCategoryCreated,
}: QuickCreateCategoryDialogProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    // Validate input
    const validation = categorySchema.safeParse({ name: name.trim() });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid category name");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create categories");
        return;
      }

      const { data, error } = await supabase
        .from("call_categories")
        .insert({
          name: validation.data.name,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Category created successfully");
      onCategoryCreated?.(data.id);
      onOpenChange(false);
      setName("");
    } catch (error) {
      logger.error("Error creating category", error);
      toast.error("Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new category to organize your meeting calls
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
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
            {saving ? "Creating..." : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
