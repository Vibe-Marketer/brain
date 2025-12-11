import { useState, useEffect } from "react";
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

interface QuickCreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderCreated?: (folderId: string) => void;
  parentFolderId?: string;
}

interface FolderWithDepth {
  id: string;
  name: string;
  depth: number;
  parent_id: string | null;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function QuickCreateFolderDialog({
  open,
  onOpenChange,
  onFolderCreated,
  parentFolderId,
}: QuickCreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [emoji, setEmoji] = useState("📁");
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(parentFolderId);
  const [saving, setSaving] = useState(false);
  const [foldersWithDepth, setFoldersWithDepth] = useState<FolderWithDepth[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Load folders for parent selection
  useEffect(() => {
    if (open) {
      loadFolders();
    }
  }, [open]);

  // Update selected parent if prop changes
  useEffect(() => {
    setSelectedParentId(parentFolderId);
  }, [parentFolderId]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data, error } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;

      // Compute depth for each folder
      const foldersMap = new Map<string, Folder>(
        (data || []).map(f => [f.id, f])
      );

      const computeDepth = (folderId: string, visited = new Set<string>()): number => {
        if (visited.has(folderId)) return 0;
        visited.add(folderId);
        const folder = foldersMap.get(folderId);
        if (!folder || !folder.parent_id) return 0;
        return 1 + computeDepth(folder.parent_id, visited);
      };

      const foldersWithDepth: FolderWithDepth[] = (data || []).map(f => ({
        ...f,
        depth: computeDepth(f.id),
      }));

      setFoldersWithDepth(foldersWithDepth);
    } catch (error) {
      logger.error("Error loading folders", error);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleCreate = async () => {
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
        toast.error("You must be logged in to create folders");
        return;
      }

      // Check depth constraint
      if (selectedParentId) {
        const parentFolder = foldersWithDepth.find(f => f.id === selectedParentId);
        if (parentFolder && parentFolder.depth >= 2) {
          toast.error("Cannot create folder: Maximum folder depth is 3 levels");
          return;
        }
      }

      // Check for duplicate name
      let query = supabase
        .from("folders")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", validation.data.name);

      if (selectedParentId) {
        query = query.eq("parent_id", selectedParentId);
      } else {
        query = query.is("parent_id", null);
      }

      const { data: existingFolder, error: checkError } = await query.maybeSingle();
      if (checkError) throw checkError;

      if (existingFolder) {
        const location = selectedParentId
          ? `in folder "${foldersWithDepth.find(f => f.id === selectedParentId)?.name}"`
          : "at root level";
        toast.error(`A folder named "${validation.data.name}" already exists ${location}`);
        return;
      }

      // Create folder
      const { data, error } = await supabase
        .from("folders")
        .insert({
          name: validation.data.name,
          description: validation.data.description,
          user_id: user.id,
          parent_id: selectedParentId || null,
          icon: emoji,
          position: 0,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Folder created successfully");
      onFolderCreated?.(data.id);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      logger.error("Error creating folder", error);
      toast.error("Failed to create folder");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setShowDescription(false);
    setEmoji("📁");
    setSelectedParentId(parentFolderId);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Filter folders that can be parents (depth < 2)
  const availableParentFolders = foldersWithDepth.filter(f => f.depth < 2);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new folder with a name, icon, parent folder, and optional description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name with inline emoji */}
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {}}
                className="w-10 h-10 flex items-center justify-center text-xl rounded-md border border-cb-border bg-cb-card hover:bg-cb-hover transition-colors"
                title="Selected emoji"
              >
                {emoji}
              </button>
              <Input
                id="folder-name"
                placeholder="e.g., Client Meetings"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving && name.trim()) {
                    handleCreate();
                  }
                }}
                className="flex-1"
                autoFocus
              />
            </div>
          </div>

          {/* Emoji picker inline */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <EmojiPickerInline value={emoji} onChange={setEmoji} />
          </div>

          {/* Parent Folder */}
          <div className="space-y-2">
            <Label htmlFor="parent-folder">Parent Folder</Label>
            <Select
              value={selectedParentId || "none"}
              onValueChange={(value) => setSelectedParentId(value === "none" ? undefined : value)}
              disabled={loadingFolders}
            >
              <SelectTrigger id="parent-folder">
                <SelectValue placeholder="None (Root Level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Root Level)</SelectItem>
                {availableParentFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {"  ".repeat(folder.depth)}{folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-description"
                checked={showDescription}
                onCheckedChange={(checked) => setShowDescription(checked === true)}
              />
              <Label htmlFor="show-description" className="text-sm font-normal cursor-pointer">
                Add description
              </Label>
            </div>
            {showDescription && (
              <Input
                id="folder-description"
                placeholder="Brief description of this folder"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
