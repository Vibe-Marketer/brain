import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getSafeUser, requireUser } from "@/lib/auth-utils";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import type { Tag, Category } from "@/types/tags";

export type { Tag, Category };

export function useTagSync() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagAssignments, setTagAssignments] = useState<Record<string, string[]>>({});
  const { activeOrgId } = useOrganizationContext();

  // Reload tags when active organization changes
  useEffect(() => {
    loadTags();
  }, [activeOrgId]);

  const loadTags = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      let query = supabase
        .from("call_tags")
        .select("id, name")
        .order("name");

      // Scope tags to the active organization/workspace
      if (activeOrgId) {
        query = query.eq("organization_id", activeOrgId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      logger.error("Error loading tags", error);
    }
  };

  const loadTagAssignments = useCallback(async (recordingIds: string[]) => {
    try {
      const { data } = await supabase
        .from("call_tag_assignments")
        .select("recording_id, tag_id")
        .in("recording_id", recordingIds);

      const assignmentMap: Record<string, string[]> = {};
      (data || []).forEach((a) => {
        const key = a.recording_id;
        if (!assignmentMap[key]) assignmentMap[key] = [];
        assignmentMap[key].push(a.tag_id);
      });

      setTagAssignments(assignmentMap);
    } catch (error) {
      logger.error("Error loading tag assignments", error);
    }
  }, []);

  const handleTagCall = useCallback(async (
    recordingId: string,
    tagIds: string[],
    onSuccess?: () => void
  ) => {
    try {
      const user = await requireUser();

      // Delete existing assignments
      await supabase
        .from("call_tag_assignments")
        .delete()
        .eq("recording_id", recordingId);

      // Insert new assignments
      if (tagIds.length > 0) {
        const assignments = tagIds.map((tagId) => ({
          recording_id: recordingId,
          tag_id: tagId,
          auto_assigned: false,
          user_id: user.id,
        }));

        const { error } = await supabase
          .from("call_tag_assignments")
          .insert(assignments);

        if (error) throw error;
      }

      setTagAssignments((prev) => ({
        ...prev,
        [recordingId]: tagIds,
      }));

      toast.success("Tags updated successfully");
      onSuccess?.();
    } catch (error) {
      logger.error("Error tagging call", error);
      toast.error("Failed to update tags");
    }
  }, []);

  const handleBulkTag = useCallback(async (
    selectedIds: string[],
    tagId: string
  ) => {
    try {
      const user = await requireUser();
      const assignments = selectedIds.map((id) => ({
        recording_id: id,
        tag_id: tagId,
        auto_assigned: false,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from("call_tag_assignments")
        .upsert(assignments, {
          onConflict: "recording_id,tag_id",
        });

      if (error) throw error;

      // Update local state
      const updates: Record<string, string[]> = {};
      selectedIds.forEach((id) => {
        const key = String(id);
        const existing = tagAssignments[key] || [];
        if (!existing.includes(tagId)) {
          updates[key] = [...existing, tagId];
        }
      });

      setTagAssignments((prev) => ({ ...prev, ...updates }));
      toast.success(`Tagged ${selectedIds.length} transcripts`);
    } catch (error) {
      logger.error("Error bulk tagging", error);
      toast.error("Failed to tag transcripts");
    }
  }, [tagAssignments]);

  const createTag = useCallback(async (
    name: string,
    description: string,
    color: string,
    onSuccess?: () => void
  ) => {
    try {
      const user = await requireUser();
      if (!activeOrgId) throw new Error("No active organization selected");

      const { data, error } = await supabase
        .from("call_tags")
        .insert({ name, description, color, user_id: user.id, organization_id: activeOrgId })
        .select()
        .single();

      if (error) throw error;

      setTags((prev) => [...prev, data]);
      toast.success("Tag created successfully");
      onSuccess?.();

      return data.id;
    } catch (error) {
      logger.error("Error creating tag", error);
      toast.error("Failed to create tag");
      return null;
    }
  }, []);

  return {
    tags,
    tagAssignments,
    loadTags,
    loadTagAssignments,
    handleTagCall,
    handleBulkTag,
    createTag,
    // Backward-compatible aliases
    categories: tags,
    categoryAssignments: tagAssignments,
    loadCategories: loadTags,
    loadCategoryAssignments: loadTagAssignments,
    handleCategorizeCall: handleTagCall,
    handleBulkCategorize: handleBulkTag,
    createCategory: createTag,
  };
}

// Backward-compatible alias
export const useCategorySync = useTagSync;
