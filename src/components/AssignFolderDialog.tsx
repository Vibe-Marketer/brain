import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
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
import type { FolderWithDepth } from "@/types/folders";
import { toRecordingUuidBatch } from "@/lib/recording-ids";
import {
  assignWorkspaceEntryToFolder,
  removeWorkspaceEntryFromFolder,
} from "@/services/folders.service";

// Extended folder type with is_personal flag used internally
interface FolderWithPersonal extends FolderWithDepth {
  is_personal: boolean;
}

// Extended folder type for tree structure
interface FolderTreeNode extends FolderWithPersonal {
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
  const { activeOrganizationId } = useOrganizationContext();
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track all folders flat for saving operations
  const [allFolders, setAllFolders] = useState<FolderWithPersonal[]>([]);

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
      const { resolved, uuids: canonicalUuids, legacyIds } = await toRecordingUuidBatch(targetRecordingIds);
      const totalCount = resolved.length;

      const parallelFetches: [
        Promise<{ folder_id: string }[]>,
        Promise<{ recording_id: string; folder_id: string | null }[]>,
      ] = [
        legacyIds.length > 0
          ? supabase
              .from("folder_assignments")
              .select("call_recording_id, folder_id")
              .in("call_recording_id", legacyIds)
              .then(({ data, error }) => {
                if (error) throw error;
                return (data || []).map(a => ({ folder_id: a.folder_id }));
              })
          : Promise.resolve([]),
        canonicalUuids.length > 0
          ? supabase
              .from("workspace_entries")
              .select("recording_id, folder_id")
              .in("recording_id", canonicalUuids)
              .not("folder_id", "is", null)
              .then(({ data, error }) => {
                if (error) throw error;
                return (data || []) as { recording_id: string; folder_id: string | null }[];
              })
          : Promise.resolve([]),
      ];

      const [legacyRows, uuidRows] = await Promise.all(parallelFetches);

      const allFolderIds = [
        ...legacyRows.map(a => a.folder_id),
        ...uuidRows.map(e => e.folder_id).filter((f): f is string => f !== null),
      ];

      if (isBulkMode) {
        // Intersection: count per folder_id across both sources
        const counts = new Map<string, number>();
        allFolderIds.forEach(fid => counts.set(fid, (counts.get(fid) || 0) + 1));

        const common = new Set<string>();
        counts.forEach((count, id) => {
          if (count === totalCount) common.add(id);
        });
        setSelectedFolders(common);
      } else {
        setSelectedFolders(new Set(allFolderIds));
      }
    } catch (error) {
      logger.error("Error loading folder assignments", error);
    } finally {
      setLoading(false);
    }
  }, [targetRecordingIds, isBulkMode]);

  const loadFolders = useCallback(async () => {
    try {
      // 1. Fetch Legacy Folders
      let legacyQuery = supabase
        .from("folders")
        .select("id, name, color, parent_id, icon, position")
        .order("position");

      if (activeOrganizationId) {
        legacyQuery = legacyQuery.eq("organization_id", activeOrganizationId);
      }

      const { data: legacyData, error: legacyError } = await legacyQuery;
      if (legacyError) throw legacyError;

      // personal_folders table is pending migration — only legacy folders for now
      const all: FolderWithPersonal[] = (legacyData || []).map(f => ({ ...f, is_personal: false }));

      setAllFolders(all);

      // Build tree structure
      const tree = buildFolderTree(all);
      setFolderTree(tree);
    } catch (error) {
      logger.error("Error loading folders", error);
    }
  }, [activeOrganizationId]);

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
  const buildFolderTree = (folders: FolderWithPersonal[]): FolderTreeNode[] => {
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

    // Sort by type (Legacy vs Personal), then position, fallback to name
    const sortFolders = (folderList: FolderTreeNode[]) => {
      folderList.sort((a, b) => {
        // Personal folders first or last? Spec says "Personal" is user's private space.
        // Let's put personal folders at the top to be prominent.
        if (a.is_personal !== b.is_personal) return a.is_personal ? -1 : 1;

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
      const { resolved, uuids: canonicalUuids, legacyIds } = await toRecordingUuidBatch(targetRecordingIds);

      const { user } = await getSafeUser();
      const userId = user?.id || null;

      // Non-personal folders only — personal folder writes are pending migration
      const legacySelected = new Set(
        Array.from(selectedFolders).filter(id => allFolders.find(f => f.id === id && !f.is_personal))
      );

      let writtenCount = 0;

      // ── Legacy path (Fathom dual-write): folder_assignments for recordings with a legacyId ──
      if (legacyIds.length > 0) {
        const { data: existingLegacy } = await supabase
          .from("folder_assignments")
          .select("call_recording_id, folder_id")
          .in("call_recording_id", legacyIds);

        // Deletions
        const legacyToDelete = (existingLegacy || []).filter(a => !legacySelected.has(a.folder_id));
        for (const a of legacyToDelete) {
          await supabase
            .from("folder_assignments")
            .delete()
            .eq("call_recording_id", a.call_recording_id)
            .eq("folder_id", a.folder_id)
            .eq("user_id", userId);
          writtenCount++;
        }

        // Insertions
        const legacyToAdd: { call_recording_id: number; folder_id: string; assigned_by: string | null; user_id: string | null }[] = [];
        legacyIds.forEach(rid => {
          legacySelected.forEach(fid => {
            if (!(existingLegacy || []).some(a => a.call_recording_id === rid && a.folder_id === fid)) {
              legacyToAdd.push({ call_recording_id: rid, folder_id: fid, assigned_by: userId, user_id: userId });
              writtenCount++;
            }
          });
        });
        if (legacyToAdd.length > 0) {
          await supabase.from("folder_assignments").insert(legacyToAdd);
        }
      }

      // ── UUID-canonical write: workspace_entries.folder_id for ALL recordings ──
      // Fetch current workspace_entries state to diff additions vs removals
      const { data: existingEntries } = canonicalUuids.length > 0
        ? await supabase
            .from("workspace_entries")
            .select("recording_id, folder_id")
            .in("recording_id", canonicalUuids)
        : { data: [] };

      const currentEntryFolderMap = new Map<string, string | null>();
      (existingEntries || []).forEach((e: { recording_id: string; folder_id: string | null }) => {
        currentEntryFolderMap.set(e.recording_id, e.folder_id);
      });

      for (const rec of resolved) {
        const workspaceId =
          allFolders.find(f => legacySelected.has(f.id))?.workspace_id ?? "";

        for (const fid of legacySelected) {
          const currentFolder = currentEntryFolderMap.get(rec.uuid);
          if (currentFolder !== fid) {
            await assignWorkspaceEntryToFolder(rec.uuid, fid, workspaceId);
            writtenCount++;
          }
        }

        // If no folders selected, clear any existing assignment
        if (legacySelected.size === 0) {
          const currentFolder = currentEntryFolderMap.get(rec.uuid);
          if (currentFolder) {
            await removeWorkspaceEntryFromFolder(rec.uuid, currentFolder, "");
            writtenCount++;
          }
        }

        // Remove from folders no longer selected (deselected folders)
        const currentFolder = currentEntryFolderMap.get(rec.uuid);
        if (currentFolder && !legacySelected.has(currentFolder)) {
          const folderWorkspaceId =
            allFolders.find(f => f.id === currentFolder)?.workspace_id ?? "";
          await removeWorkspaceEntryFromFolder(rec.uuid, currentFolder, folderWorkspaceId);
          writtenCount++;
        }
      }

      const count = targetRecordingIds.length;
      const folderCount = selectedFolders.size;

      if (writtenCount > 0) {
        // Build informative success message
        if (folderCount === 0) {
          toast.success(`Removed from all folders (${count} meeting${count > 1 ? 's' : ''})`);
        } else {
          // Get folder names for feedback
          const selectedFolderNames = allFolders
            .filter(f => selectedFolders.has(f.id))
            .map(f => f.name)
            .slice(0, 3);

          const folderNamesDisplay = selectedFolderNames.join(', ') +
            (folderCount > 3 ? ` +${folderCount - 3} more` : '');

          toast.success(
            `${count > 1 ? `${count} meetings` : 'Meeting'} assigned to: ${folderNamesDisplay}`,
            { duration: 4000 }
          );
        }
      } else {
        toast.info("No changes made");
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
          <RiFolderLine
            className="h-4 w-4 flex-shrink-0"
          />

          {/* Folder Name */}
          <label
            htmlFor={folder.id}
            className={cn(
              "flex-1 text-sm cursor-pointer truncate",
              isSelected && "font-medium"
            )}
          >
            {folder.name}
            {folder.is_personal && (
              <span className="ml-2 text-[10px] bg-vibe-orange/10 text-vibe-orange px-1 rounded uppercase font-bold tracking-tighter">Personal</span>
            )}
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
