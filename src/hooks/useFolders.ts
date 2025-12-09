import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { requireUser } from "@/lib/auth-utils";
import type { Folder, FolderAssignment } from "@/types/folders";

// Re-export types for consumers
export type { Folder, FolderAssignment } from "@/types/folders";

interface CreateFolderParams {
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  description?: string | null;
}

interface UpdateFolderParams {
  id: string;
  updates: Partial<Omit<Folder, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
}

interface AssignToFolderParams {
  recordingIds: number[];
  folderId: string;
}

interface RemoveFromFolderParams {
  recordingIds: number[];
  folderId: string;
}

interface MoveToFolderParams {
  recordingIds: number[];
  fromFolderId: string | null;
  toFolderId: string;
}

export function useFolders() {
  const queryClient = useQueryClient();

  // Fetch all folders for the current user
  const { data: folders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.folders.list(),
    queryFn: async () => {
      const user = await requireUser();

      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("position");

      if (error) throw error;
      return (data || []) as Folder[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch folder assignments for all recordings
  const { data: folderAssignments = {} } = useQuery({
    queryKey: queryKeys.folders.assignments(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folder_assignments")
        .select("folder_id, call_recording_id, assigned_at");

      if (error) throw error;

      // Transform to Record<string, string[]> - map of recording_id to folder_ids
      const assignmentMap: Record<string, string[]> = {};
      (data || []).forEach((assignment) => {
        const key = String(assignment.call_recording_id);
        if (!assignmentMap[key]) {
          assignmentMap[key] = [];
        }
        assignmentMap[key].push(assignment.folder_id);
      });

      return assignmentMap;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async ({ name, parentId = null, color = "#6B7280", icon = "folder", description = null }: CreateFolderParams) => {
      const user = await requireUser();

      // Get the next position for this folder level
      let positionQuery = supabase
        .from("folders")
        .select("position")
        .eq("user_id", user.id);

      // Use .is() for null comparison, .eq() for actual values
      if (parentId) {
        positionQuery = positionQuery.eq("parent_id", parentId);
      } else {
        positionQuery = positionQuery.is("parent_id", null);
      }

      const { data: existingFolders } = await positionQuery
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = existingFolders?.[0]?.position ? existingFolders[0].position + 1 : 0;

      const { data, error } = await supabase
        .from("folders")
        .insert({
          user_id: user.id,
          name,
          description,
          color,
          icon,
          parent_id: parentId,
          position: nextPosition,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Folder;
    },
    onSuccess: (newFolder) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.list() });
      toast.success(`Folder "${newFolder.name}" created successfully`);
    },
    onError: (error) => {
      logger.error("Error creating folder", error);
      toast.error("Failed to create folder");
    },
  });

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, updates }: UpdateFolderParams) => {
      const { error } = await supabase
        .from("folders")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.list() });

      // Snapshot the previous value
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKeys.folders.list());

      // Optimistically update to the new value
      if (previousFolders) {
        queryClient.setQueryData<Folder[]>(
          queryKeys.folders.list(),
          previousFolders.map((folder) =>
            folder.id === id ? { ...folder, ...updates, updated_at: new Date().toISOString() } : folder
          )
        );
      }

      return { previousFolders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.list() });
      toast.success("Folder updated successfully");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousFolders) {
        queryClient.setQueryData(queryKeys.folders.list(), context.previousFolders);
      }
      logger.error("Error updating folder", error);
      toast.error("Failed to update folder");
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.list() });

      // Snapshot the previous value
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKeys.folders.list());

      // Optimistically update to the new value
      if (previousFolders) {
        queryClient.setQueryData<Folder[]>(
          queryKeys.folders.list(),
          previousFolders.filter((folder) => folder.id !== id)
        );
      }

      return { previousFolders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.assignments() });
      toast.success("Folder deleted successfully");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousFolders) {
        queryClient.setQueryData(queryKeys.folders.list(), context.previousFolders);
      }
      logger.error("Error deleting folder", error);
      toast.error("Failed to delete folder");
    },
  });

  // Assign recordings to folder mutation
  const assignToFolderMutation = useMutation({
    mutationFn: async ({ recordingIds, folderId }: AssignToFolderParams) => {
      const user = await requireUser();

      const assignments = recordingIds.map((id) => ({
        call_recording_id: id,
        folder_id: folderId,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from("folder_assignments")
        .upsert(assignments, {
          onConflict: "folder_id,call_recording_id,user_id",
        });

      if (error) throw error;
    },
    onMutate: async ({ recordingIds, folderId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.assignments() });

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData<Record<string, string[]>>(
        queryKeys.folders.assignments()
      );

      // Optimistically update to the new value
      if (previousAssignments) {
        const newAssignments = { ...previousAssignments };
        recordingIds.forEach((id) => {
          const key = String(id);
          if (!newAssignments[key]) {
            newAssignments[key] = [];
          }
          if (!newAssignments[key].includes(folderId)) {
            newAssignments[key] = [...newAssignments[key], folderId];
          }
        });
        queryClient.setQueryData(queryKeys.folders.assignments(), newAssignments);
      }

      return { previousAssignments };
    },
    onSuccess: (_data, { recordingIds }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.assignments() });
      toast.success(`${recordingIds.length} recording${recordingIds.length > 1 ? 's' : ''} added to folder`);
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousAssignments) {
        queryClient.setQueryData(queryKeys.folders.assignments(), context.previousAssignments);
      }
      logger.error("Error assigning to folder", error);
      toast.error("Failed to add recordings to folder");
    },
  });

  // Remove recordings from folder mutation
  const removeFromFolderMutation = useMutation({
    mutationFn: async ({ recordingIds, folderId }: RemoveFromFolderParams) => {
      const { error } = await supabase
        .from("folder_assignments")
        .delete()
        .in("call_recording_id", recordingIds)
        .eq("folder_id", folderId);

      if (error) throw error;
    },
    onMutate: async ({ recordingIds, folderId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.assignments() });

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData<Record<string, string[]>>(
        queryKeys.folders.assignments()
      );

      // Optimistically update to the new value
      if (previousAssignments) {
        const newAssignments = { ...previousAssignments };
        recordingIds.forEach((id) => {
          const key = String(id);
          if (newAssignments[key]) {
            newAssignments[key] = newAssignments[key].filter((fid) => fid !== folderId);
            if (newAssignments[key].length === 0) {
              delete newAssignments[key];
            }
          }
        });
        queryClient.setQueryData(queryKeys.folders.assignments(), newAssignments);
      }

      return { previousAssignments };
    },
    onSuccess: (_data, { recordingIds }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.assignments() });
      toast.success(`${recordingIds.length} recording${recordingIds.length > 1 ? 's' : ''} removed from folder`);
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousAssignments) {
        queryClient.setQueryData(queryKeys.folders.assignments(), context.previousAssignments);
      }
      logger.error("Error removing from folder", error);
      toast.error("Failed to remove recordings from folder");
    },
  });

  // Move recordings from one folder to another mutation
  const moveToFolderMutation = useMutation({
    mutationFn: async ({ recordingIds, fromFolderId, toFolderId }: MoveToFolderParams) => {
      const user = await requireUser();

      // Delete from old folder if specified
      if (fromFolderId) {
        const { error: deleteError } = await supabase
          .from("folder_assignments")
          .delete()
          .in("call_recording_id", recordingIds)
          .eq("folder_id", fromFolderId)
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;
      }

      // Add to new folder
      const assignments = recordingIds.map((id) => ({
        call_recording_id: id,
        folder_id: toFolderId,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from("folder_assignments")
        .upsert(assignments, {
          onConflict: "folder_id,call_recording_id,user_id",
        });

      if (insertError) throw insertError;
    },
    onMutate: async ({ recordingIds, fromFolderId, toFolderId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.assignments() });

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData<Record<string, string[]>>(
        queryKeys.folders.assignments()
      );

      // Optimistically update to the new value
      if (previousAssignments) {
        const newAssignments = { ...previousAssignments };
        recordingIds.forEach((id) => {
          const key = String(id);
          if (!newAssignments[key]) {
            newAssignments[key] = [];
          }

          // Remove from old folder if specified
          if (fromFolderId) {
            newAssignments[key] = newAssignments[key].filter((fid) => fid !== fromFolderId);
          }

          // Add to new folder if not already there
          if (!newAssignments[key].includes(toFolderId)) {
            newAssignments[key] = [...newAssignments[key], toFolderId];
          }

          // Clean up empty arrays
          if (newAssignments[key].length === 0) {
            delete newAssignments[key];
          }
        });
        queryClient.setQueryData(queryKeys.folders.assignments(), newAssignments);
      }

      return { previousAssignments };
    },
    onSuccess: (_data, { recordingIds }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.assignments() });
      toast.success(`${recordingIds.length} recording${recordingIds.length > 1 ? 's' : ''} moved to folder`);
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousAssignments) {
        queryClient.setQueryData(queryKeys.folders.assignments(), context.previousAssignments);
      }
      logger.error("Error moving to folder", error);
      toast.error("Failed to move recordings to folder");
    },
  });

  // Helper function to get folders for a specific call
  const getFoldersForCall = (recordingId: number): Folder[] => {
    const assignedFolderIds = folderAssignments[String(recordingId)] || [];
    return folders.filter((folder) => assignedFolderIds.includes(folder.id));
  };

  return {
    folders,
    folderAssignments,
    isLoading,
    createFolder: (name: string, parentId?: string, color?: string, icon?: string, description?: string) =>
      createFolderMutation.mutateAsync({ name, parentId, color, icon, description }),
    updateFolder: (id: string, updates: Partial<Omit<Folder, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) =>
      updateFolderMutation.mutateAsync({ id, updates }),
    deleteFolder: (id: string) => deleteFolderMutation.mutateAsync(id),
    assignToFolder: (recordingIds: number[], folderId: string) =>
      assignToFolderMutation.mutateAsync({ recordingIds, folderId }),
    removeFromFolder: (recordingIds: number[], folderId: string) =>
      removeFromFolderMutation.mutateAsync({ recordingIds, folderId }),
    moveToFolder: (recordingIds: number[], fromFolderId: string | null, toFolderId: string) =>
      moveToFolderMutation.mutateAsync({ recordingIds, fromFolderId, toFolderId }),
    getFoldersForCall,
    refetch,
  };
}
