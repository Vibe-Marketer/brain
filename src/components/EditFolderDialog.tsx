import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EmojiPickerInline } from "@/components/ui/emoji-picker-inline";
import { RiAddLine } from "@remixicon/react";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";

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
  const [showDescription, setShowDescription] = useState(false);
  const [emoji, setEmoji] = useState("📁");
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Inline parent folder creation
  const [inlineParentDialogOpen, setInlineParentDialogOpen] = useState(false);

  // Ref for focus management
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Handle focus when dialog opens
  const handleOpenAutoFocus = useCallback((event: Event) => {
    // Prevent default focus behavior and focus the name input
    event.preventDefault();
    // Use setTimeout to ensure the dialog is fully rendered
    setTimeout(() => {
      nameInputRef.current?.focus();
      // Select all text for easy editing
      nameInputRef.current?.select();
    }, 0);
  }, []);

  // Initialize form with folder data when opened
  useEffect(() => {
    if (open && folder) {
      setName(folder.name || "");
      setDescription(folder.description || "");
      setShowDescription(!!folder.description);
      setEmoji(folder.icon || "📁");
      setSelectedParentId(folder.parent_id || undefined);
      loadFolders();
    }
  }, [open, folder]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      // Note: Do NOT query 'depth' column - it doesn't exist in the database
      // Depth is computed client-side to avoid database schema dependencies
      const { data, error } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;

      // Compute depth client-side by traversing parent relationships
      const foldersMap = new Map<string, { id: string; parent_id: string | null }>(
        (data || []).map(f => [f.id, f])
      );

      const computeDepth = (folderId: string, visited = new Set<string>()): number => {
        if (visited.has(folderId)) return 0; // Prevent infinite loops from circular refs
        visited.add(folderId);
        const folder = foldersMap.get(folderId);
        if (!folder || !folder.parent_id) return 0;
        return 1 + computeDepth(folder.parent_id, visited);
      };

      const foldersWithDepth: FolderOption[] = (data || []).map(f => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        depth: computeDepth(f.id),
      }));

      setFolders(foldersWithDepth);
    } catch (error) {
      logger.error("Error loading folders", error);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleUpdate = async () => {
    if (!folder) return;

    const validation = folderSchema.safeParse({
      name: name.trim(),
      description: showDescription ? description.trim() || undefined : undefined
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

      // Check depth constraint
      if (selectedParentId) {
        const parentFolder = folders.find(f => f.id === selectedParentId);
        if (parentFolder && parentFolder.depth >= 2) {
          toast.error("Cannot move folder: Maximum folder depth is 3 levels");
          return;
        }

        if (selectedParentId === folder.id) {
          toast.error("A folder cannot be its own parent");
          return;
        }

        // Check circular reference
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

      // Check duplicate name
      let duplicateQuery = supabase
        .from("folders")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", validation.data.name)
        .neq("id", folder.id);

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
      const { error } = await supabase
        .from("folders")
        .update({
          name: validation.data.name,
          description: showDescription ? validation.data.description : null,
          parent_id: selectedParentId || null,
          icon: emoji,
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

  // Filter folders to exclude current and descendants
  const getAvailableParentFolders = (): FolderOption[] => {
    if (!folder) return folders.filter(f => f.depth < 2);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={handleOpenAutoFocus}
        aria-describedby="edit-folder-description"
      >
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
          <DialogDescription id="edit-folder-description" className="sr-only">
            Edit the folder name, icon, parent folder, and description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name with emoji indicator */}
          <div className="space-y-2">
            <Label htmlFor="edit-folder-name">Folder Name</Label>
            <div className="flex items-center gap-2">
              {/* Emoji indicator (non-interactive, just shows current selection) */}
              <div
                className="w-10 h-10 flex items-center justify-center text-xl rounded-md border border-border bg-cb-card"
                aria-label={`Selected icon: ${emoji}`}
                aria-hidden="true"
              >
                {emoji}
              </div>
              <Input
                ref={nameInputRef}
                id="edit-folder-name"
                placeholder="e.g., Client Meetings"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving && name.trim()) {
                    handleUpdate();
                  }
                }}
                className="flex-1"
                aria-describedby="edit-folder-name-hint"
              />
            </div>
            <p id="edit-folder-name-hint" className="sr-only">
              Edit the folder name. Press Enter to save.
            </p>
          </div>

          {/* Emoji picker inline */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <EmojiPickerInline value={emoji} onChange={setEmoji} />
          </div>

          {/* Parent Folder */}
          <div className="space-y-2">
            <Label htmlFor="edit-parent-folder">Parent Folder</Label>
            <Select
              value={selectedParentId || "none"}
              onValueChange={(value) => {
                if (value === "__create_new_parent__") {
                  setInlineParentDialogOpen(true);
                } else {
                  setSelectedParentId(value === "none" ? undefined : value);
                }
              }}
              disabled={loadingFolders}
            >
              <SelectTrigger id="edit-parent-folder">
                <SelectValue placeholder="None (Root Level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__create_new_parent__">
                  <div className="flex items-center gap-2 text-primary">
                    <RiAddLine className="h-4 w-4" />
                    Create New Parent Folder
                  </div>
                </SelectItem>
                <SelectItem value="none">None (Root Level)</SelectItem>
                {availableParentFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {"  ".repeat(f.depth)}{f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-show-description"
                checked={showDescription}
                onCheckedChange={(checked) => setShowDescription(checked === true)}
              />
              <Label htmlFor="edit-show-description" className="text-sm font-normal cursor-pointer">
                Add description
              </Label>
            </div>
            {showDescription && (
              <Input
                id="edit-folder-description"
                placeholder="Brief description of this folder"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Inline Parent Folder Creation Dialog */}
      {inlineParentDialogOpen && (
        <QuickCreateFolderDialog
          open={inlineParentDialogOpen}
          onOpenChange={setInlineParentDialogOpen}
          onFolderCreated={(newParentId) => {
            // Auto-select the newly created parent folder
            setSelectedParentId(newParentId);
            // Reload folders list to show the new parent
            loadFolders();
          }}
        />
      )}
    </Dialog>
  );
}
