import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { folderSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import * as RemixIcon from "@remixicon/react";
import { IconEmojiPicker, FOLDER_COLORS, isEmojiIcon, getIconComponent } from "@/components/ui/icon-emoji-picker";

interface Folder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  depth?: number;
}

interface EditFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder | null;
  onFolderUpdated?: () => void;
}



interface FolderOption {
  id: string;
  name: string;
  depth: number;
  parent_id: string | null;
}

export default function EditFolderDialog({
  open,
  onOpenChange,
  folder,
  onFolderUpdated,
}: EditFolderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [icon, setIcon] = useState<string>('folder');
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);
  const [customColor, setCustomColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Initialize form with folder data when opened
  useEffect(() => {
    if (open && folder) {
      setName(folder.name || "");
      setDescription(folder.description || "");
      setColor(folder.color || FOLDER_COLORS[0]);
      setIcon(folder.icon || 'folder');
      setSelectedParentId(folder.parent_id || undefined);

      // Check if it's a custom color
      if (folder.color && !FOLDER_COLORS.includes(folder.color)) {
        setCustomColor(folder.color);
      } else {
        setCustomColor("");
      }

      loadFolders();
    }
  }, [open, folder]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data, error } = await supabase
        .from("folders")
        .select("id, name, depth, parent_id")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      logger.error("Error loading folders", error);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleUpdate = async () => {
    if (!folder) return;

    // Validate input
    const validation = folderSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid folder name");
      return;
    }

    setSaving(true);
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        toast.error("You must be logged in to update folders");
        return;
      }

      // Check if parent folder would violate depth constraint
      if (selectedParentId) {
        const parentFolder = folders.find(f => f.id === selectedParentId);
        if (parentFolder && parentFolder.depth >= 2) {
          toast.error("Cannot move folder: Maximum folder depth is 3 levels");
          return;
        }

        // Prevent setting self or descendants as parent
        if (selectedParentId === folder.id) {
          toast.error("A folder cannot be its own parent");
          return;
        }

        // Check if selected parent is a descendant of the current folder
        const isDescendant = (potentialParentId: string): boolean => {
          const potentialParent = folders.find(f => f.id === potentialParentId);
          if (!potentialParent) return false;
          if (potentialParent.parent_id === folder.id) return true;
          if (potentialParent.parent_id) return isDescendant(potentialParent.parent_id);
          return false;
        };

        if (isDescendant(selectedParentId)) {
          toast.error("Cannot move folder: would create circular reference");
          return;
        }
      }

      // Check for duplicate name within same parent (excluding current folder)
      let duplicateQuery = supabase
        .from("folders")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", validation.data.name)
        .neq("id", folder.id);

      // Use .is() for null comparison, .eq() for actual values
      if (selectedParentId) {
        duplicateQuery = duplicateQuery.eq("parent_id", selectedParentId);
      } else {
        duplicateQuery = duplicateQuery.is("parent_id", null);
      }

      const { data: existingFolder, error: checkError } = await duplicateQuery.maybeSingle();

      if (checkError) throw checkError;

      if (existingFolder) {
        const location = selectedParentId
          ? `in folder "${folders.find(f => f.id === selectedParentId)?.name}"`
          : "at root level";
        toast.error(`A folder named "${validation.data.name}" already exists ${location}`);
        return;
      }

      // Update folder
      const finalColor = customColor || color;
      const { error } = await supabase
        .from("folders")
        .update({
          name: validation.data.name,
          description: validation.data.description,
          parent_id: selectedParentId || null,
          icon,
          color: finalColor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", folder.id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Folder updated successfully");
      onFolderUpdated?.();
      onOpenChange(false);
    } catch (error) {
      logger.error("Error updating folder", error);
      toast.error("Failed to update folder");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  // Use shared utilities from icon-emoji-picker
  const isEmoji = isEmojiIcon(icon);
  const IconComponent = getIconComponent(icon);

  // Filter folders to exclude current folder and its descendants, and only show those that can be parents (depth < 2)
  const getAvailableParentFolders = (): FolderOption[] => {
    if (!folder) return folders.filter(f => f.depth < 2);

    // Get all descendant IDs
    const getDescendantIds = (folderId: string): string[] => {
      const children = folders.filter(f => f.parent_id === folderId);
      return children.flatMap(child => [child.id, ...getDescendantIds(child.id)]);
    };

    const excludeIds = new Set([folder.id, ...getDescendantIds(folder.id)]);

    return folders.filter(f => f.depth < 2 && !excludeIds.has(f.id));
  };

  const availableParentFolders = getAvailableParentFolders();

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
          <DialogDescription>
            Update folder settings and organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name *</Label>
            <Input
              id="folder-name"
              placeholder="e.g., Client Meetings, Team Calls"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) {
                  handleUpdate();
                }
              }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="folder-description">Description (optional)</Label>
            <Input
              id="folder-description"
              placeholder="Brief description of this folder"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Parent Folder */}
          <div className="space-y-2">
            <Label htmlFor="parent-folder">Parent Folder (optional)</Label>
            <Select
              value={selectedParentId || "none"}
              onValueChange={(value) => setSelectedParentId(value === "none" ? undefined : value)}
              disabled={loadingFolders}
            >
              <SelectTrigger id="parent-folder">
                <SelectValue placeholder="Select parent folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Root Level)</SelectItem>
                {availableParentFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {"  ".repeat(f.depth)}{f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap items-center">
              {FOLDER_COLORS.map((colorValue) => (
                <button
                  key={colorValue}
                  type="button"
                  onClick={() => {
                    setColor(colorValue);
                    setCustomColor("");
                  }}
                  className={`w-8 h-8 rounded-md border-2 transition-all ${
                    color === colorValue && !customColor
                      ? 'border-cb-ink scale-110'
                      : 'border-cb-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: colorValue }}
                  title={colorValue}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <Label htmlFor="custom-color" className="text-xs">
                  Custom:
                </Label>
                <input
                  id="custom-color"
                  type="color"
                  value={customColor || color}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-8 h-8 rounded border border-cb-border cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Icon/Emoji Picker */}
          <div className="space-y-2">
            <Label>Icon or Emoji</Label>
            <IconEmojiPicker
              value={icon}
              onChange={setIcon}
              color={customColor || color}
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-2 p-3 rounded-md border border-cb-border bg-cb-card">
              {isEmoji ? (
                <span className="text-xl">{icon}</span>
              ) : IconComponent ? (
                <IconComponent
                  className="h-5 w-5"
                  style={{ color: customColor || color }}
                />
              ) : (
                <RemixIcon.RiFolderLine
                  className="h-5 w-5"
                  style={{ color: customColor || color }}
                />
              )}
              <span className="font-medium">
                {name || "Folder Name"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
