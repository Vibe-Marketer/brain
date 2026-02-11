import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { useBankContext } from "@/hooks/useBankContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { RiArrowRightSLine, RiArrowDownSLine, RiFolderLine, RiCheckLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { isEmojiIcon, getIconComponent } from "@/components/ui/icon-emoji-picker";
import type { FolderWithDepth } from "@/types/folders";

// Extended folder type for tree structure
interface FolderTreeNode extends FolderWithDepth {
  icon?: string;
  position?: number;
  children: FolderTreeNode[];
}

interface AssignFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId?: string;
  recordingIds?: string[];
  onFoldersUpdated: () => void;
  onCreateFolder?: () => void;
}

export default function AssignFolderDialog({
  open,
  onOpenChange,
  recordingId,
  recordingIds,
  onFoldersUpdated,
  onCreateFolder,
}: AssignFolderDialogProps) {
  const { activeBankId } = useBankContext();
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track all folders flat for saving operations
  const [allFolders, setAllFolders] = useState<FolderWithDepth[]>([]);

  const isBulkMode = recordingIds && recordingIds.length > 1;

  // Wrap in useMemo to prevent re-creation on every render
  const targetRecordingIds = useMemo(() =>
    recordingIds || (recordingId ? [recordingId] : []),
    [recordingIds, recordingId]
  );

  const loadExistingAssignments = useCallback(async () => {
    if (targetRecordingIds.length === 0) return;

    setLoading(true);
    try {
      const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));

      const { data, error } = await supabase
        .from("folder_assignments")
        .select("call_recording_id, folder_id")
        .in("call_recording_id", numericRecordingIds);

      if (error) throw error;

      if (isBulkMode) {
        // For bulk mode, show folders that ALL selected calls have in common
        const folderCounts = new Map<string, number>();
        data?.forEach(assignment => {
          const count = folderCounts.get(assignment.folder_id) || 0;
          folderCounts.set(assignment.folder_id, count + 1);
        });

        // Only pre-select folders that ALL calls have
        const commonFolders = new Set<string>();
        folderCounts.forEach((count, folderId) => {
          if (count === numericRecordingIds.length) {
            commonFolders.add(folderId);
          }
        });

        setSelectedFolders(commonFolders);
      } else {
        // For single mode, show all assigned folders
        const assigned = new Set(data?.map(a => a.folder_id) || []);
        setSelectedFolders(assigned);
      }
    } catch (error) {
      logger.error("Error loading folder assignments", error);
    } finally {
      setLoading(false);
    }
  }, [targetRecordingIds, isBulkMode]);

  const loadFolders = useCallback(async () => {
    try {
      let query = supabase
        .from("folders")
        .select("id, name, color, parent_id, icon, position")
        .order("position");

      if (activeBankId) {
        query = query.eq("bank_id", activeBankId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Store flat list for operations
      setAllFolders(data || []);

      // Build tree structure
      const tree = buildFolderTree(data || []);
      setFolderTree(tree);

      // Auto-expand all parent folders that have selected children
      // (will be set after loadExistingAssignments runs)
    } catch (error) {
      logger.error("Error loading folders", error);
    }
  }, []);

  // Auto-expand parents of selected folders
  const autoExpandParents = useCallback((selectedIds: Set<string>, folders: FolderWithDepth[]) => {
    const parentIds = new Set<string>();
    const folderMap = new Map(folders.map(f => [f.id, f]));

    selectedIds.forEach(selectedId => {
      let current = folderMap.get(selectedId);
      while (current?.parent_id) {
        parentIds.add(current.parent_id);
        current = folderMap.get(current.parent_id);
      }
    });

    if (parentIds.size > 0) {
      setExpandedFolders(prev => new Set([...prev, ...parentIds]));
    }
  }, []);

  useEffect(() => {
    if (open && targetRecordingIds.length > 0) {
      loadFolders();
      loadExistingAssignments();
    }
    // Reset expanded state when dialog closes
    if (!open) {
      setExpandedFolders(new Set());
    }
  }, [open, targetRecordingIds.length, loadExistingAssignments, loadFolders]);

  // Auto-expand when selected folders change
  useEffect(() => {
    if (selectedFolders.size > 0 && allFolders.length > 0) {
      autoExpandParents(selectedFolders, allFolders);
    }
  }, [selectedFolders, allFolders, autoExpandParents]);

  // Build a tree structure from flat folder list
  const buildFolderTree = (folders: FolderWithDepth[]): FolderTreeNode[] => {
    const folderMap = new Map<string, FolderTreeNode>();
    const rootFolders: FolderTreeNode[] = [];

    // Initialize all folders with children array
    folders.forEach((folder) => {
      folderMap.set(folder.id, { ...folder, children: [] } as FolderTreeNode);
    });

    // Build tree structure
    folders.forEach((folder) => {
      const folderNode = folderMap.get(folder.id)!;
      if (folder.parent_id === null) {
        rootFolders.push(folderNode);
      } else {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(folderNode);
        } else {
          // Orphaned folder - add to root
          rootFolders.push(folderNode);
        }
      }
    });

    // Sort by position, fallback to name
    const sortFolders = (folderList: FolderTreeNode[]) => {
      folderList.sort((a, b) => {
        const posA = a.position ?? 999;
        const posB = b.position ?? 999;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });
      folderList.forEach((folder) => {
        if (folder.children.length > 0) {
          sortFolders(folder.children);
        }
      });
    };

    sortFolders(rootFolders);
    return rootFolders;
  };

  // Toggle folder expansion
  const toggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleFolder = (folderId: string) => {
    const newSelected = new Set(selectedFolders);
    if (newSelected.has(folderId)) {
      newSelected.delete(folderId);
    } else {
      newSelected.add(folderId);
    }
    setSelectedFolders(newSelected);
  };

  const handleSave = async () => {
    if (targetRecordingIds.length === 0) return;

    setSaving(true);
    try {
      const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));

      // Get existing assignments for all selected recordings
      const { data: existingAssignments, error: fetchError } = await supabase
        .from("folder_assignments")
        .select("call_recording_id, folder_id")
        .in("call_recording_id", numericRecordingIds);

      if (fetchError) throw fetchError;

      // Create a map of existing assignments by recording_id
      const existingByRecording = new Map<number, Set<string>>();
      existingAssignments?.forEach(assignment => {
        if (!existingByRecording.has(assignment.call_recording_id)) {
          existingByRecording.set(assignment.call_recording_id, new Set());
        }
        existingByRecording.get(assignment.call_recording_id)!.add(assignment.folder_id);
      });

      // Determine which assignments to delete and which to add
      const assignmentsToDelete: Array<{call_recording_id: number, folder_id: string}> = [];
      const assignmentsToAdd: Array<{call_recording_id: number, folder_id: string, assigned_by: string | null, user_id: string | null}> = [];

      // Get current user ID for assigned_by
      const { user } = await getSafeUser();
      const userId = user?.id || null;

      numericRecordingIds.forEach(recordingId => {
        const existing = existingByRecording.get(recordingId) || new Set();

        // Find folders to delete (were selected before but not now)
        existing.forEach(folderId => {
          if (!selectedFolders.has(folderId)) {
            assignmentsToDelete.push({ call_recording_id: recordingId, folder_id: folderId });
          }
        });

        // Find folders to add (selected now but weren't before)
        selectedFolders.forEach(folderId => {
          if (!existing.has(folderId)) {
            assignmentsToAdd.push({
              call_recording_id: recordingId,
              folder_id: folderId,
              assigned_by: userId,
              user_id: userId,  // Required for composite FK
            });
          }
        });
      });

      // Delete removed assignments
      if (assignmentsToDelete.length > 0) {
        for (const assignment of assignmentsToDelete) {
          await supabase
            .from("folder_assignments")
            .delete()
            .eq("call_recording_id", assignment.call_recording_id)
            .eq("folder_id", assignment.folder_id)
            .eq("user_id", userId);  // Required for composite FK
        }
      }

      // Insert new assignments
      if (assignmentsToAdd.length > 0) {
        const { error } = await supabase
          .from("folder_assignments")
          .insert(assignmentsToAdd);

        if (error) throw error;
      }

      const count = targetRecordingIds.length;
      const folderCount = selectedFolders.size;

      // Build informative success message
      if (folderCount === 0) {
        toast.success(`Removed from all folders (${count} meeting${count > 1 ? 's' : ''})`);
      } else {
        // Get folder names for feedback
        const selectedFolderNames = allFolders
          .filter(f => selectedFolders.has(f.id))
          .map(f => f.name)
          .slice(0, 3); // Show max 3 names

        const folderNamesDisplay = selectedFolderNames.join(', ') +
          (folderCount > 3 ? ` +${folderCount - 3} more` : '');

        toast.success(
          `${count > 1 ? `${count} meetings` : 'Meeting'} assigned to: ${folderNamesDisplay}`,
          { duration: 4000 }
        );
      }

      onFoldersUpdated();
      onOpenChange(false);
    } catch (error) {
      logger.error("Error saving folder assignments", error);
      toast.error("Failed to update folder assignments");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFolder = () => {
    if (onCreateFolder) {
      onCreateFolder();
    } else {
      toast.info("Create folder feature coming soon");
    }
  };

  // Render a single folder item with proper hierarchy
  const renderFolderItem = (folder: FolderTreeNode, depth: number = 0) => {
    const hasChildren = folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolders.has(folder.id);

    // Get the appropriate icon
    const folderIsEmoji = folder.icon ? isEmojiIcon(folder.icon) : false;
    const FolderIcon = folder.icon ? getIconComponent(folder.icon) : null;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
            "hover:bg-muted/50",
            isSelected && "bg-primary/10",
            depth > 0 && "ml-4"
          )}
          style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
        >
          {/* Expand/Collapse button for folders with children */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(folder.id);
              }}
              className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
            >
              {isExpanded ? (
                <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
              ) : (
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          {/* Checkbox */}
          <Checkbox
            id={folder.id}
            checked={isSelected}
            onCheckedChange={() => toggleFolder(folder.id)}
            className="flex-shrink-0"
          />

          {/* Folder Icon */}
          {folderIsEmoji ? (
            <span className="text-base flex-shrink-0">{folder.icon}</span>
          ) : FolderIcon ? (
            <FolderIcon
              className="h-4 w-4 flex-shrink-0"
              style={{ color: folder.color || '#6B7280' }}
            />
          ) : (
            <RiFolderLine
              className="h-4 w-4 flex-shrink-0"
              style={{ color: folder.color || '#6B7280' }}
            />
          )}

          {/* Folder Name */}
          <label
            htmlFor={folder.id}
            className={cn(
              "flex-1 text-sm cursor-pointer truncate",
              isSelected && "font-medium"
            )}
          >
            {folder.name}
          </label>

          {/* Selected indicator */}
          {isSelected && (
            <RiCheckLine className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>

        {/* Children - render recursively when expanded */}
        {hasChildren && isExpanded && (
          <div className="border-l border-muted ml-4 pl-0">
            {folder.children.map((child) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Count selected folders for save button feedback
  const selectedCount = selectedFolders.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Folders</DialogTitle>
          <DialogDescription>
            {isBulkMode ? (
              <>Assigning {targetRecordingIds.length} meetings to folders</>
            ) : (
              <>Select folders for this meeting (can be in multiple)</>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : folderTree.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <RiFolderLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No folders yet.</p>
            <p className="text-xs mt-1">Create a folder to get started.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto -mx-2 px-2">
            {folderTree.map((folder) => renderFolderItem(folder, 0))}
          </div>
        )}

        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          <Button
            variant="link"
            onClick={handleCreateFolder}
            className="text-sm px-0"
          >
            + Create New Folder
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="hollow" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                "Saving..."
              ) : selectedCount > 0 ? (
                `Save (${selectedCount} folder${selectedCount !== 1 ? 's' : ''})`
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
