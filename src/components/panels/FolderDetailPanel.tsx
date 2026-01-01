import { useState, useEffect, useMemo } from "react";
import { useFolders, type Folder } from "@/hooks/useFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RiFolderLine,
  RiPhoneLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
} from "@remixicon/react";
import { toast } from "sonner";
import { folderSchema } from "@/lib/validations";
import { isEmojiIcon, getIconComponent } from "@/lib/folder-icons";
import { EmojiPickerInline } from "@/components/ui/emoji-picker-inline";
import { usePanelStore } from "@/stores/panelStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FolderDetailPanelProps {
  folderId: string;
  onFolderUpdated?: () => void;
  onFolderDeleted?: () => void;
}

export function FolderDetailPanel({
  folderId,
  onFolderUpdated,
  onFolderDeleted,
}: FolderDetailPanelProps) {
  const { folders, folderAssignments, updateFolder, deleteFolder, isLoading, refetch } = useFolders();
  const { closePanel, togglePin, isPinned } = usePanelStore();

  // Find the folder from the list
  const folder = useMemo(
    () => folders.find((f) => f.id === folderId),
    [folders, folderId]
  );

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [emoji, setEmoji] = useState("📁");
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate folder call count from assignments
  const callCount = useMemo(() => {
    let count = 0;
    Object.values(folderAssignments).forEach((folderIds) => {
      if (folderIds.includes(folderId)) {
        count += 1;
      }
    });
    return count;
  }, [folderAssignments, folderId]);

  // Initialize form with folder data
  useEffect(() => {
    if (folder) {
      setName(folder.name || "");
      setDescription(folder.description || "");
      setShowDescription(!!folder.description);
      setEmoji(folder.icon || "📁");
      setSelectedParentId(folder.parent_id || undefined);
      setHasChanges(false);
    }
  }, [folder]);

  // Track changes
  useEffect(() => {
    if (!folder) return;

    const nameChanged = name !== folder.name;
    const descChanged = showDescription
      ? description !== (folder.description || "")
      : !!folder.description;
    const emojiChanged = emoji !== (folder.icon || "📁");
    const parentChanged = selectedParentId !== (folder.parent_id || undefined);

    setHasChanges(nameChanged || descChanged || emojiChanged || parentChanged);
  }, [folder, name, description, showDescription, emoji, selectedParentId]);

  // Get available parent folders (exclude current folder and its descendants)
  const availableParentFolders = useMemo(() => {
    if (!folder) return folders.filter((f) => (f as any).depth === undefined || (f as any).depth < 2);

    const getDescendantIds = (fId: string): string[] => {
      const children = folders.filter((f) => f.parent_id === fId);
      return children.flatMap((child) => [child.id, ...getDescendantIds(child.id)]);
    };

    const excludeIds = new Set([folder.id, ...getDescendantIds(folder.id)]);
    return folders.filter((f) => !excludeIds.has(f.id));
  }, [folders, folder]);

  const handleSave = async () => {
    if (!folder) return;

    const validation = folderSchema.safeParse({
      name: name.trim(),
      description: showDescription ? description.trim() || undefined : undefined,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid folder name");
      return;
    }

    // Check circular reference
    if (selectedParentId) {
      if (selectedParentId === folder.id) {
        toast.error("A folder cannot be its own parent");
        return;
      }

      const isDescendant = (potentialParentId: string): boolean => {
        const potentialParent = folders.find((f) => f.id === potentialParentId);
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

    setSaving(true);
    try {
      await updateFolder(folder.id, {
        name: validation.data.name,
        description: showDescription ? validation.data.description || null : null,
        parent_id: selectedParentId || null,
        icon: emoji,
      });

      setHasChanges(false);
      onFolderUpdated?.();
      refetch();
    } catch {
      // Error handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!folder) return;

    setIsDeleting(true);
    try {
      await deleteFolder(folder.id);
      setDeleteConfirmOpen(false);
      closePanel();
      onFolderDeleted?.();
    } catch {
      // Error handled by hook
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Folder not found
  if (!folder) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-cb-ink">Folder Not Found</h3>
          <Button variant="ghost" size="sm" onClick={closePanel}>
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-cb-ink-muted">
          The selected folder could not be found. It may have been deleted.
        </p>
      </div>
    );
  }

  const FolderIcon = getIconComponent(folder.icon);
  const isEmoji = isEmojiIcon(folder.icon);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cb-border">
        <div className="flex items-center gap-3 min-w-0">
          {isEmoji ? (
            <span className="text-2xl flex-shrink-0">{folder.icon}</span>
          ) : FolderIcon ? (
            <FolderIcon
              className="h-6 w-6 flex-shrink-0"
              style={{ color: folder.color }}
            />
          ) : (
            <RiFolderLine
              className="h-6 w-6 flex-shrink-0"
              style={{ color: folder.color }}
            />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-cb-ink truncate">{folder.name}</h3>
            {folder.description && (
              <p className="text-xs text-cb-ink-muted truncate">{folder.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            title={isPinned ? "Unpin panel" : "Pin panel"}
          >
            {isPinned ? (
              <RiPushpinFill className="h-4 w-4 text-cb-ink" />
            ) : (
              <RiPushpinLine className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={closePanel} title="Close panel">
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-cb-card rounded-lg p-3 border border-cb-border">
            <div className="flex items-center gap-2 text-cb-ink-muted mb-1">
              <RiPhoneLine className="h-4 w-4" />
              <span className="text-xs">Calls</span>
            </div>
            <div className="text-2xl font-semibold text-cb-ink tabular-nums">
              {callCount}
            </div>
          </div>
          <div className="bg-cb-card rounded-lg p-3 border border-cb-border">
            <div className="flex items-center gap-2 text-cb-ink-muted mb-1">
              <RiCalendarLine className="h-4 w-4" />
              <span className="text-xs">Created</span>
            </div>
            <div className="text-sm font-medium text-cb-ink">
              {formatDate(folder.created_at)}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide">
            Edit Folder
          </h4>

          {/* Name with icon preview */}
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center text-xl rounded-md border border-cb-border bg-cb-card hover:bg-cb-hover transition-colors flex-shrink-0"
                title="Selected icon"
              >
                {emoji}
              </button>
              <Input
                id="folder-name"
                placeholder="e.g., Client Meetings"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
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
              onValueChange={(value) =>
                setSelectedParentId(value === "none" ? undefined : value)
              }
            >
              <SelectTrigger id="parent-folder">
                <SelectValue placeholder="None (Root Level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Root Level)</SelectItem>
                {availableParentFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
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
              <Label
                htmlFor="show-description"
                className="text-sm font-normal cursor-pointer"
              >
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

        {/* Metadata */}
        <div className="space-y-2 pt-4 border-t border-cb-border">
          <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide">
            Details
          </h4>
          <div className="text-sm text-cb-ink-muted space-y-1">
            <p>Created: {formatDate(folder.created_at)}</p>
            <p>Updated: {formatDate(folder.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-cb-border space-y-2">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving || !name.trim() || !hasChanges}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="hollow"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <RiDeleteBinLine className="h-4 w-4 mr-2" />
          Delete Folder
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{folder.name}&quot;? This action
              cannot be undone. Calls in this folder will not be deleted but will no
              longer be assigned to this folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default FolderDetailPanel;
