import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface Category {
  id: string;
  name: string;
}

interface ManualCategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId?: string | null;
  recordingIds?: string[];
  callTitle?: string;
  onCategoriesUpdated?: () => void;
}

export default function ManualCategorizeDialog({
  open,
  onOpenChange,
  recordingId,
  recordingIds,
  callTitle,
  onCategoriesUpdated,
}: ManualCategorizeDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isBulkMode = recordingIds && recordingIds.length > 1;
  const targetRecordingIds = recordingIds || (recordingId ? [recordingId] : []);

  const loadExistingAssignments = useCallback(async () => {
    if (targetRecordingIds.length === 0) return;

    setLoading(true);
    try {
      const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));

      const { data, error } = await supabase
        .from("call_category_assignments")
        .select("call_recording_id, category_id")
        .in("call_recording_id", numericRecordingIds);

      if (error) throw error;

      if (isBulkMode) {
        // For bulk mode, show categories that ALL selected calls have in common
        const categoryCounts = new Map<string, number>();
        data?.forEach(assignment => {
          const count = categoryCounts.get(assignment.category_id) || 0;
          categoryCounts.set(assignment.category_id, count + 1);
        });

        // Only pre-select categories that ALL calls have
        const commonCategories = new Set<string>();
        categoryCounts.forEach((count, categoryId) => {
          if (count === numericRecordingIds.length) {
            commonCategories.add(categoryId);
          }
        });

        setSelectedCategories(commonCategories);
      } else {
        // For single mode, show all assigned categories
        const assigned = new Set(data?.map(a => a.category_id) || []);
        setSelectedCategories(assigned);
      }
    } catch (error) {
      logger.error("Error loading assignments", error);
    } finally {
      setLoading(false);
    }
  }, [targetRecordingIds, isBulkMode]);

  useEffect(() => {
    if (open && targetRecordingIds.length > 0) {
      loadCategories();
      // Always load existing assignments to show what's currently assigned
      loadExistingAssignments();
    }
  }, [open, targetRecordingIds.length, loadExistingAssignments]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("call_categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logger.error("Error loading categories", error);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  const handleSave = async () => {
    if (targetRecordingIds.length === 0) return;
    
    setSaving(true);
    try {
      const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));
      
      // Get existing assignments for all selected recordings
      const { data: existingAssignments, error: fetchError } = await supabase
        .from("call_category_assignments")
        .select("call_recording_id, category_id")
        .in("call_recording_id", numericRecordingIds);
      
      if (fetchError) throw fetchError;
      
      // Create a map of existing assignments by recording_id
      const existingByRecording = new Map<number, Set<string>>();
      existingAssignments?.forEach(assignment => {
        if (!existingByRecording.has(assignment.call_recording_id)) {
          existingByRecording.set(assignment.call_recording_id, new Set());
        }
        existingByRecording.get(assignment.call_recording_id)!.add(assignment.category_id);
      });
      
      // Determine which assignments to delete and which to add
      const assignmentsToDelete: Array<{call_recording_id: number, category_id: string}> = [];
      const assignmentsToAdd: Array<{call_recording_id: number, category_id: string, auto_assigned: boolean}> = [];
      
      numericRecordingIds.forEach(recordingId => {
        const existing = existingByRecording.get(recordingId) || new Set();
        
        // Find categories to delete (were selected before but not now)
        existing.forEach(categoryId => {
          if (!selectedCategories.has(categoryId)) {
            assignmentsToDelete.push({ call_recording_id: recordingId, category_id: categoryId });
          }
        });
        
        // Find categories to add (selected now but weren't before)
        selectedCategories.forEach(categoryId => {
          if (!existing.has(categoryId)) {
            assignmentsToAdd.push({
              call_recording_id: recordingId,
              category_id: categoryId,
              auto_assigned: false,
            });
          }
        });
      });
      
      // Delete removed assignments
      if (assignmentsToDelete.length > 0) {
        for (const assignment of assignmentsToDelete) {
          await supabase
            .from("call_category_assignments")
            .delete()
            .eq("call_recording_id", assignment.call_recording_id)
            .eq("category_id", assignment.category_id);
        }
      }
      
      // Insert new assignments
      if (assignmentsToAdd.length > 0) {
        const { error } = await supabase
          .from("call_category_assignments")
          .insert(assignmentsToAdd);

        if (error) throw error;
      }

      const count = targetRecordingIds.length;
      toast.success(`Categories updated for ${count} meeting${count > 1 ? 's' : ''}`);
      onCategoriesUpdated?.();
      onOpenChange(false);
    } catch (error) {
      logger.error("Error saving categories", error);
      toast.error("Failed to update categories");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorize {isBulkMode ? 'Meetings' : 'Call'}</DialogTitle>
          <DialogDescription>
            {isBulkMode ? (
              <span className="block text-sm font-medium mt-1">
                Applying categories to {targetRecordingIds.length} meetings
              </span>
            ) : (
              callTitle && <span className="block text-sm font-medium mt-1">{callTitle}</span>
            )}
            Select the categories to apply
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No categories yet. Create categories first.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={category.id}
                  checked={selectedCategories.has(category.id)}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
                <Label
                  htmlFor={category.id}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {category.name}
                </Label>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
