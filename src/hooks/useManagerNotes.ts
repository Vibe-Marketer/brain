import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import type { ManagerNote } from "@/types/sharing";

interface UseManagerNotesOptions {
  callId: number | string | null;
  userId?: string;
  enabled?: boolean;
}

interface UseManagerNotesResult {
  note: ManagerNote | null;
  isLoading: boolean;
  saveNote: (noteText: string) => Promise<ManagerNote>;
  deleteNote: () => Promise<void>;
  isSaving: boolean;
}

/**
 * Hook for managers to add private notes on direct report calls
 */
export function useManagerNotes(options: UseManagerNotesOptions): UseManagerNotesResult {
  const { callId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch note for this call
  const { data: note, isLoading } = useQuery({
    queryKey: queryKeys.teams.managerNotes(callId!),
    queryFn: async () => {
      if (!callId || !userId) return null;

      const { data, error } = await supabase
        .from("manager_notes")
        .select("*")
        .eq("manager_user_id", userId)
        .eq("call_recording_id", callId)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching manager note", error);
        throw error;
      }

      return data as ManagerNote | null;
    },
    enabled: enabled && !!callId && !!userId,
  });

  // Save note mutation (create or update)
  const saveNoteMutation = useMutation({
    mutationFn: async (noteText: string): Promise<ManagerNote> => {
      if (!callId || !userId) {
        throw new Error("Call ID and User ID are required");
      }

      // Get the call owner for the composite FK
      const { data: callData, error: callError } = await supabase
        .from("fathom_calls")
        .select("user_id")
        .eq("recording_id", callId)
        .single();

      if (callError || !callData) {
        throw new Error("Call not found");
      }

      if (note) {
        // Update existing note
        const { data, error } = await supabase
          .from("manager_notes")
          .update({
            note: noteText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", note.id)
          .select()
          .single();

        if (error) {
          logger.error("Error updating manager note", error);
          throw error;
        }

        logger.info("Manager note updated", { noteId: data.id });
        return data as ManagerNote;
      } else {
        // Create new note
        const { data, error } = await supabase
          .from("manager_notes")
          .insert({
            manager_user_id: userId,
            call_recording_id: Number(callId),
            user_id: callData.user_id, // Call owner for composite FK
            note: noteText,
          })
          .select()
          .single();

        if (error) {
          logger.error("Error creating manager note", error);
          throw error;
        }

        logger.info("Manager note created", { noteId: data.id });
        return data as ManagerNote;
      }
    },
    onSuccess: () => {
      if (callId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.managerNotes(callId) });
      }
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!note) {
        throw new Error("No note to delete");
      }

      const { error } = await supabase
        .from("manager_notes")
        .delete()
        .eq("id", note.id);

      if (error) {
        logger.error("Error deleting manager note", error);
        throw error;
      }

      logger.info("Manager note deleted", { noteId: note.id });
    },
    onSuccess: () => {
      if (callId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.managerNotes(callId) });
      }
    },
  });

  return {
    note: note || null,
    isLoading,
    saveNote: saveNoteMutation.mutateAsync,
    deleteNote: deleteNoteMutation.mutateAsync,
    isSaving: saveNoteMutation.isPending || deleteNoteMutation.isPending,
  };
}
