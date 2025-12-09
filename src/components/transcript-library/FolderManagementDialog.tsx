import { useState } from "react";
import {
  RiFolderOpenLine,
  RiAddLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiAlertLine,
} from "@remixicon/react";
import { isEmojiIcon, getIconComponent } from "@/components/ui/icon-emoji-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Folder } from "@/types/folders";

interface FolderManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  onCreateFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  transcriptCounts?: Record<string, number>;
}

export function FolderManagementDialog({
  open,
  onOpenChange,
  folders,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  transcriptCounts = {},
}: FolderManagementDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);

  // Group folders by parent for nested display
  const topLevelFolders = folders.filter((f) => !f.parent_id);
  const foldersByParent = folders.reduce((acc, folder) => {
    const parentId = folder.parent_id || "root";
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(folder);
    return acc;
  }, {} as Record<string, Folder[]>);

  const handleDeleteClick = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToDelete(folder);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (folderToDelete) {
      onDeleteFolder(folderToDelete);
      setFolderToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const renderFolder = (folder: Folder, depth: number = 0) => {
    const childFolders = foldersByParent[folder.id] || [];
    const transcriptCount = transcriptCounts[folder.id];
    const indentClass = depth > 0 ? `ml-${depth * 6}` : "";

    // Compute folder icon - either emoji or icon component
    const folderIsEmoji = isEmojiIcon(folder.icon);
    const FolderIcon = folderIsEmoji ? null : (getIconComponent(folder.icon) ?? RiFolderOpenLine);

    return (
      <div key={folder.id}>
        <div
          className={`group flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${indentClass}`}
        >
          {/* Color indicator */}
          {folder.color && (
            <div
              className="w-1 h-14 rounded flex-shrink-0"
              style={{ backgroundColor: folder.color }}
            />
          )}

          {/* Folder icon */}
          {folderIsEmoji ? (
            <span className="text-lg mt-0.5 flex-shrink-0">{folder.icon}</span>
          ) : FolderIcon && (
            <FolderIcon
              className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0"
              style={folder.color ? { color: folder.color } : undefined}
            />
          )}

          {/* Folder info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{folder.name}</h4>
              {transcriptCount !== undefined && (
                <Badge variant="secondary" className="h-5 px-2 text-xs">
                  {transcriptCount}
                </Badge>
              )}
            </div>
            {folder.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {folder.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="hollow"
              size="sm"
              onClick={() => onEditFolder(folder)}
              className="h-8 w-8 p-0"
            >
              <RiPencilLine className="h-3.5 w-3.5" />
              <span className="sr-only">Edit folder</span>
            </Button>
            <Button
              variant="hollow"
              size="sm"
              onClick={(e) => handleDeleteClick(folder, e)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <RiDeleteBinLine className="h-3.5 w-3.5" />
              <span className="sr-only">Delete folder</span>
            </Button>
          </div>
        </div>

        {/* Render child folders with increased depth */}
        {childFolders.length > 0 && (
          <div className="mt-2 space-y-2">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Manage Folders</DialogTitle>
            <DialogDescription>
              Create and organize your transcript folders
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Create New Folder Button */}
            <Button onClick={onCreateFolder} className="w-full gap-2">
              <RiAddLine className="h-4 w-4" />
              Create New Folder
            </Button>

            {/* Folders List */}
            <ScrollArea className="flex-1 min-h-[300px] max-h-[500px] pr-4">
              {folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <RiFolderOpenLine className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No folders yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create your first folder to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topLevelFolders.map((folder) => renderFolder(folder))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <RiAlertLine className="h-5 w-5" />
              <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left space-y-2">
              <p className="text-foreground">
                Are you sure you want to delete{" "}
                <strong className="text-destructive">
                  {folderToDelete?.name}
                </strong>
                ?
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. Transcripts in this folder will
                not be deleted, but they will no longer be organized under this
                folder.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="hollow"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
