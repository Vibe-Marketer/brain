import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface Category {
  id: string;
  name: string;
}

export function useCategorySync() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryAssignments, setCategoryAssignments] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("call_categories")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logger.error("Error loading categories", error);
    }
  };

  const loadCategoryAssignments = useCallback(async (recordingIds: string[]) => {
    try {
      const { data } = await supabase
        .from("call_category_assignments")
        .select("call_recording_id, category_id")
        .in("call_recording_id", recordingIds.map((id) => parseInt(id)));

      const assignmentMap: Record<string, string[]> = {};
      (data || []).forEach((a) => {
        const key = String(a.call_recording_id);
        if (!assignmentMap[key]) assignmentMap[key] = [];
        assignmentMap[key].push(a.category_id);
      });
      
      setCategoryAssignments(assignmentMap);
    } catch (error) {
      logger.error("Error loading category assignments", error);
    }
  }, []);

  const handleCategorizeCall = useCallback(async (
    recordingId: string,
    categoryIds: string[],
    onSuccess?: () => void
  ) => {
    try {
      const numericId = parseInt(recordingId);

      // Delete existing assignments
      await supabase
        .from("call_category_assignments")
        .delete()
        .eq("call_recording_id", numericId);

      // Insert new assignments
      if (categoryIds.length > 0) {
        const assignments = categoryIds.map((categoryId) => ({
          call_recording_id: numericId,
          category_id: categoryId,
          auto_assigned: false,
        }));

        const { error } = await supabase
          .from("call_category_assignments")
          .insert(assignments);

        if (error) throw error;
      }

      setCategoryAssignments((prev) => ({
        ...prev,
        [recordingId]: categoryIds,
      }));

      toast.success("Categories updated successfully");
      onSuccess?.();
    } catch (error) {
      logger.error("Error categorizing call", error);
      toast.error("Failed to update categories");
    }
  }, []);

  const handleBulkCategorize = useCallback(async (
    selectedIds: number[],
    categoryId: string
  ) => {
    try {
      const assignments = selectedIds.map((id) => ({
        call_recording_id: id,
        category_id: categoryId,
        auto_assigned: false,
      }));

      const { error } = await supabase
        .from("call_category_assignments")
        .upsert(assignments, {
          onConflict: "call_recording_id,category_id",
        });

      if (error) throw error;

      // Update local state
      const updates: Record<string, string[]> = {};
      selectedIds.forEach((id) => {
        const key = String(id);
        const existing = categoryAssignments[key] || [];
        if (!existing.includes(categoryId)) {
          updates[key] = [...existing, categoryId];
        }
      });

      setCategoryAssignments((prev) => ({ ...prev, ...updates }));
      toast.success(`Categorized ${selectedIds.length} transcripts`);
    } catch (error) {
      logger.error("Error bulk categorizing", error);
      toast.error("Failed to categorize transcripts");
    }
  }, [categoryAssignments]);

  const createCategory = useCallback(async (
    name: string,
    description: string,
    icon: string,
    onSuccess?: () => void
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("call_categories")
        .insert({ name, description, icon, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      setCategories((prev) => [...prev, data]);
      toast.success("Category created successfully");
      onSuccess?.();
      
      return data.id;
    } catch (error) {
      logger.error("Error creating category", error);
      toast.error("Failed to create category");
      return null;
    }
  }, []);

  return {
    categories,
    categoryAssignments,
    loadCategories,
    loadCategoryAssignments,
    handleCategorizeCall,
    handleBulkCategorize,
    createCategory,
  };
}
