import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Folder {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  depth?: number;
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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const { data, error } = await supabase
        .from("folders")
        .select("id, name, color, parent_id")
        .order("name");

      if (error) throw error;

      // Sort folders to show nested structure (parents before children)
      const sortedFolders = sortFoldersHierarchically(data || []);
      setFolders(sortedFolders);
    } catch (error) {
      logger.error("Error loading folders", error);
    }
  }, []);

  useEffect(() => {
    if (open && targetRecordingIds.length > 0) {
      loadFolders();
      loadExistingAssignments();
    }
  }, [open, targetRecordingIds.length, loadExistingAssignments, loadFolders]);

  const sortFoldersHierarchically = (folders: Folder[]): Folder[] => {
    // Build a map of parent_id -> children
    const folderMap = new Map<string | null, Folder[]>();
    folders.forEach(folder => {
      const parentId = folder.parent_id;
      if (!folderMap.has(parentId)) {
        folderMap.set(parentId, []);
      }
      folderMap.get(parentId)!.push(folder);
    });

    // Recursively build sorted list
    const sorted: Folder[] = [];
    const addFoldersRecursively = (parentId: string | null, depth: number = 0) => {
      const children = folderMap.get(parentId) || [];
      children.sort((a, b) => a.name.localeCompare(b.name));
      children.forEach(folder => {
        sorted.push({ ...folder, depth });
        addFoldersRecursively(folder.id, depth + 1);
      });
    };

    addFoldersRecursively(null, 0);
    return sorted;
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
      toast.success(`Folders updated for ${count} meeting${count > 1 ? 's' : ''}`);
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
    // DEBUG: Using alert to ensure this fires - will remove after debugging
    alert("DEBUG: handleCreateFolder clicked! onCreateFolder is: " + typeof onCreateFolder);
    console.log("[AssignFolderDialog] handleCreateFolder called, onCreateFolder:", typeof onCreateFolder);
    if (onCreateFolder) {
      console.log("[AssignFolderDialog] Calling onCreateFolder callback");
      onCreateFolder();
    } else {
      // Fallback for backwards compatibility
      console.log("[AssignFolderDialog] No onCreateFolder callback, showing toast");
      toast.info("Create folder feature coming soon");
    }
  };

  const getFolderDisplayName = (folder: Folder): string => {
    const indent = "  ".repeat(folder.depth || 0);
    return `${indent}${folder.name}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Folders</DialogTitle>
          <DialogDescription>
            {isBulkMode ? (
              <span className="block text-sm font-medium mt-1">
                Assigning {targetRecordingIds.length} meetings to folders
              </span>
            ) : (
              <span className="block text-sm font-medium mt-1">
                A call can be in multiple folders
              </span>
            )}
            Select the folders for this meeting
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : folders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No folders yet. Create a folder to get started.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center space-x-2">
                <Checkbox
                  id={folder.id}
                  checked={selectedFolders.has(folder.id)}
                  onCheckedChange={() => toggleFolder(folder.id)}
                />
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: folder.color || '#6B7280' }}
                />
                <Label
                  htmlFor={folder.id}
                  className="text-sm font-normal cursor-pointer flex-1 font-mono"
                >
                  {getFolderDisplayName(folder)}
                </Label>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center gap-2 mt-4 pt-4 border-t">
          <Button
            variant="link"
            onClick={handleCreateFolder}
            onMouseDown={() => console.log("[AssignFolderDialog] onMouseDown on button")}
            className="text-sm"
          >
            + New Folder (v2)
          </Button>

          <div className="flex gap-2">
            <Button variant="hollow" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
