import React, { useState, useMemo } from "react";
import { useFolders, type Folder } from "@/hooks/useFolders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiFolderLine } from "@remixicon/react";
import { isEmojiIcon, getIconComponent } from "@/lib/folder-icons";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
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
import { Skeleton } from "@/components/ui/skeleton";

export function FoldersTab() {
  const { folders, folderAssignments, deleteFolder, isLoading, refetch } = useFolders();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Build hierarchy from flat folder list
  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parent_id).sort((a, b) => a.position - b.position),
    [folders]
  );

  const childrenByParent = useMemo(() => {
    return folders.reduce((acc, folder) => {
      if (folder.parent_id) {
        if (!acc[folder.parent_id]) acc[folder.parent_id] = [];
        acc[folder.parent_id].push(folder);
      }
      return acc;
    }, {} as Record<string, Folder[]>);
  }, [folders]);

  // Calculate folder call counts from assignments
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(folderAssignments).forEach((folderIds) => {
      folderIds.forEach((folderId) => {
        counts[folderId] = (counts[folderId] || 0) + 1;
      });
    });
    return counts;
  }, [folderAssignments]);

  const handleDelete = async () => {
    if (!deleteConfirmFolder) return;

    setIsDeleting(true);
    try {
      await deleteFolder(deleteConfirmFolder.id);
      setDeleteConfirmFolder(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Recursive folder row renderer - uses Fragment with key to avoid invalid DOM nesting
  const renderFolderRow = (folder: Folder, depth: number = 0): React.ReactNode => {
    const children = childrenByParent[folder.id] || [];
    const FolderIcon = getIconComponent(folder.icon);
    const isEmoji = isEmojiIcon(folder.icon);
    const sortedChildren = children.sort((a, b) => a.position - b.position);

    return (
      <React.Fragment key={folder.id}>
        <TableRow>
          <TableCell style={{ paddingLeft: `${depth * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {isEmoji ? (
                <span className="text-base">{folder.icon}</span>
              ) : FolderIcon ? (
                <FolderIcon className="h-4 w-4" style={{ color: folder.color }} />
              ) : (
                <RiFolderLine className="h-4 w-4" style={{ color: folder.color }} />
              )}
              <span className="font-medium">{folder.name}</span>
              {folder.description && (
                <span className="text-cb-ink-muted text-xs">- {folder.description}</span>
              )}
            </div>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {folderCounts[folder.id] || 0}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditFolder(folder)}
                title="Edit folder"
              >
                <RiEditLine className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmFolder(folder)}
                title="Delete folder"
              >
                <RiDeleteBinLine className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {sortedChildren.map((child) => renderFolderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cb-ink-muted">
        Folders organize your calls for easy browsing. Folder assignment has no effect on AI analysis - only tags control that.
      </p>

      <Button onClick={() => setCreateDialogOpen(true)}>
        <RiAddLine className="h-4 w-4 mr-2" />
        Create Folder
      </Button>

      <div className="border border-cb-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-cb-white dark:bg-card">
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-right">Calls</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rootFolders.map((folder) => renderFolderRow(folder))}
            {folders.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-cb-ink-muted">
                  No folders yet. Create a folder to organize calls.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <QuickCreateFolderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onFolderCreated={() => {
          refetch();
        }}
      />

      {/* Edit Dialog */}
      <EditFolderDialog
        open={!!editFolder}
        onOpenChange={(open) => !open && setEditFolder(null)}
        folder={editFolder}
        onFolderUpdated={() => {
          setEditFolder(null);
          refetch();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmFolder}
        onOpenChange={(open) => !open && setDeleteConfirmFolder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmFolder?.name}&quot;? This action cannot be undone.
              Calls in this folder will not be deleted but will no longer be assigned to this folder.
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
