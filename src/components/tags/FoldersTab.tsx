import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { RiAddLine, RiDeleteBinLine, RiFolderLine, RiPencilLine, RiFileCopyLine } from "@remixicon/react";
import { isEmojiIcon, getIconComponent } from "@/lib/folder-icons";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanelStore } from "@/stores/panelStore";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useListKeyboardNavigationWithState } from "@/hooks/useListKeyboardNavigation";

export function FoldersTab() {
  const { folders, folderAssignments, deleteFolder, updateFolder, createFolder, isLoading, refetch } = useFolders();
  const { openPanel, panelData, panelType } = usePanelStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline rename state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Track selected folder for visual highlighting
  const selectedFolderId = panelType === 'folder-detail' ? panelData?.folderId : null;

  // Get the currently selected folder object
  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find(f => f.id === selectedFolderId) || null;
  }, [selectedFolderId, folders]);

  // --- Keyboard Shortcuts ---
  // Cmd+N: Open create folder dialog
  const handleCreateShortcut = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  // Cmd+E: Edit selected folder (start inline rename)
  const handleEditShortcut = useCallback(() => {
    if (selectedFolder) {
      setEditingFolderId(selectedFolder.id);
      setEditName(selectedFolder.name);
    }
  }, [selectedFolder]);

  // Cmd+Backspace: Delete selected folder
  const handleDeleteShortcut = useCallback(() => {
    if (selectedFolder) {
      setDeleteConfirmFolder(selectedFolder);
    }
  }, [selectedFolder]);

  // Register keyboard shortcuts
  useKeyboardShortcut(handleCreateShortcut, { key: 'n' });
  useKeyboardShortcut(handleEditShortcut, { key: 'e', enabled: !!selectedFolder });
  useKeyboardShortcut(handleDeleteShortcut, { key: 'Backspace', enabled: !!selectedFolder });

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingFolderId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFolderId]);

  // Start inline rename on double-click
  const handleStartRename = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditName(folder.name);
  };

  // Save the renamed folder
  const handleSaveRename = async () => {
    if (!editingFolderId || !editName.trim()) {
      setEditingFolderId(null);
      setEditName("");
      return;
    }

    try {
      await updateFolder(editingFolderId, { name: editName.trim() });
    } finally {
      setEditingFolderId(null);
      setEditName("");
    }
  };

  // Cancel rename and restore original name
  const handleCancelRename = () => {
    setEditingFolderId(null);
    setEditName("");
  };

  // Handle keyboard events in rename input
  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const handleFolderClick = (folder: Folder) => {
    openPanel('folder-detail', { folderId: folder.id });
  };

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

  // Flatten folder hierarchy for keyboard navigation (in display order)
  const flattenedFolders = useMemo(() => {
    const result: Folder[] = [];
    const addFolder = (folder: Folder) => {
      result.push(folder);
      const children = childrenByParent[folder.id] || [];
      children.sort((a, b) => a.position - b.position).forEach(addFolder);
    };
    rootFolders.forEach(addFolder);
    return result;
  }, [rootFolders, childrenByParent]);

  // Keyboard navigation for folder list
  const { focusedId, getRowRef, handleRowClick } = useListKeyboardNavigationWithState({
    items: flattenedFolders,
    getItemId: (folder) => folder.id,
    selectedId: selectedFolderId,
    onSelect: handleFolderClick,
    enabled: !editingFolderId && !createDialogOpen && !deleteConfirmFolder, // Disable when editing or dialogs open
  });

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

  // Duplicate folder with "Copy of" prefix
  const handleDuplicateFolder = async (folder: Folder) => {
    await createFolder(
      `Copy of ${folder.name}`,
      folder.parent_id || undefined,
      folder.color,
      folder.icon,
      folder.description || undefined
    );
    refetch();
  };

  // Recursive folder row renderer - uses Fragment with key to avoid invalid DOM nesting
  const renderFolderRow = (folder: Folder, depth: number = 0): React.ReactNode => {
    const children = childrenByParent[folder.id] || [];
    const FolderIcon = getIconComponent(folder.icon);
    const isEmoji = isEmojiIcon(folder.icon);
    const sortedChildren = children.sort((a, b) => a.position - b.position);
    const isSelected = selectedFolderId === folder.id;
    const isFocused = focusedId === folder.id;
    const isEditing = editingFolderId === folder.id;

    return (
      <React.Fragment key={folder.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <TableRow
              ref={getRowRef(folder.id) as React.Ref<HTMLTableRowElement>}
              className={`cursor-pointer transition-colors ${
                isSelected
                  ? "bg-cb-hover dark:bg-cb-hover-dark"
                  : isFocused
                  ? "bg-cb-hover/30 dark:bg-cb-hover-dark/30 ring-1 ring-inset ring-vibe-orange/50"
                  : "hover:bg-cb-hover/50 dark:hover:bg-cb-hover-dark/50"
              }`}
              onClick={() => {
                handleRowClick(folder);
                if (!isEditing) handleFolderClick(folder);
              }}
            >
              <TableCell style={{ paddingLeft: `${depth * 24 + 16}px` }}>
                <div className="flex items-center gap-2">
                  {isEmoji ? (
                    <span className="text-base">{folder.icon}</span>
                  ) : FolderIcon ? (
                    <FolderIcon className="h-4 w-4" style={{ color: folder.color }} />
                  ) : (
                    <RiFolderLine className="h-4 w-4" style={{ color: folder.color }} />
                  )}
                  {isEditing ? (
                    <Input
                      ref={editInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleSaveRename}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 w-48 text-sm font-medium"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="font-medium cursor-text"
                      onDoubleClick={(e) => handleStartRename(folder, e)}
                      title="Double-click to rename"
                    >
                      {folder.name}
                    </span>
                  )}
                  {!isEditing && folder.description && (
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmFolder(folder);
                    }}
                    title="Delete folder"
                  >
                    <RiDeleteBinLine className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleStartRename(folder, e as unknown as React.MouseEvent);
              }}
            >
              <RiPencilLine className="h-4 w-4 mr-2" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleDuplicateFolder(folder)}
            >
              <RiFileCopyLine className="h-4 w-4 mr-2" />
              Duplicate
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => setDeleteConfirmFolder(folder)}
              className="text-destructive focus:text-destructive"
            >
              <RiDeleteBinLine className="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
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
                <TableCell colSpan={3} className="p-0">
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <RiFolderLine className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No folders yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                      Create folders to organize your calls. Folders help you browse and find calls but don&apos;t affect AI analysis.
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <RiAddLine className="h-4 w-4 mr-2" />
                      Create Folder
                    </Button>
                  </div>
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
