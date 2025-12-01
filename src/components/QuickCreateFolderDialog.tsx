import { useState, useEffect } from "react";
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

interface QuickCreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderCreated?: (folderId: string) => void;
  parentFolderId?: string;
}

const FOLDER_COLORS = [
  '#6B7280', // Gray (default)
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

const FOLDER_ICONS = [
  'folder',
  'folder-2',
  'folder-3',
  'folder-open',
  'briefcase',
  'archive',
  'inbox',
  'bookmark',
] as const;

interface Folder {
  id: string;
  name: string;
  depth: number;
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
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [icon, setIcon] = useState<typeof FOLDER_ICONS[number]>('folder');
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(parentFolderId);
  const [customColor, setCustomColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const handleCreate = async () => {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create folders");
        return;
      }

      // Check if parent folder would violate depth constraint
      if (selectedParentId) {
        const parentFolder = folders.find(f => f.id === selectedParentId);
        if (parentFolder && parentFolder.depth >= 2) {
          toast.error("Cannot create folder: Maximum folder depth is 3 levels");
          return;
        }
      }

      // Check for duplicate name within same parent
      const { data: existingFolder, error: checkError } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", validation.data.name)
        .eq("parent_id", selectedParentId || null)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingFolder) {
        const location = selectedParentId
          ? `in folder "${folders.find(f => f.id === selectedParentId)?.name}"`
          : "at root level";
        toast.error(`A folder named "${validation.data.name}" already exists ${location}`);
        return;
      }

      // Create folder
      const finalColor = customColor || color;
      const { data, error } = await supabase
        .from("folders")
        .insert({
          name: validation.data.name,
          description: validation.data.description,
          user_id: user.id,
          parent_id: selectedParentId || null,
          icon,
          color: finalColor,
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
    setColor(FOLDER_COLORS[0]);
    setIcon('folder');
    setCustomColor("");
    setSelectedParentId(parentFolderId);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Get icon component dynamically
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'folder': RemixIcon.RiFolderLine,
      'folder-2': RemixIcon.RiFolder2Line,
      'folder-3': RemixIcon.RiFolder3Line,
      'folder-open': RemixIcon.RiFolderOpenLine,
      'briefcase': RemixIcon.RiBriefcaseLine,
      'archive': RemixIcon.RiArchiveLine,
      'inbox': RemixIcon.RiInboxLine,
      'bookmark': RemixIcon.RiBookmarkLine,
    };
    return iconMap[iconName] || RemixIcon.RiFolderLine;
  };

  const IconComponent = getIconComponent(icon);

  // Filter folders to only show those that can be parents (depth < 2)
  const availableParentFolders = folders.filter(f => f.depth < 2);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Add a new folder to organize your meeting calls
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
                  handleCreate();
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
                {availableParentFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {"  ".repeat(folder.depth)}{folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedParentId && folders.find(f => f.id === selectedParentId)?.depth === 2 && (
              <p className="text-xs text-destructive">
                This folder is already at maximum depth
              </p>
            )}
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_ICONS.map((iconName) => {
                const Icon = getIconComponent(iconName);
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={`p-2 rounded-md border transition-colors ${
                      icon === iconName
                        ? 'border-cb-ink bg-cb-ink/5'
                        : 'border-cb-border hover:border-cb-ink/50'
                    }`}
                  >
                    <Icon className="h-5 w-5 text-cb-ink-muted" />
                  </button>
                );
              })}
            </div>
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

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-2 p-3 rounded-md border border-cb-border bg-cb-card">
              <IconComponent
                className="h-5 w-5"
                style={{ color: customColor || color }}
              />
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
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
