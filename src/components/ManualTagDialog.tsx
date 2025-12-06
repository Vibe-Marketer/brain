import { useState, useEffect, useCallback, useMemo } from "react";
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

interface Tag {
  id: string;
  name: string;
}

interface ManualTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId?: string | null;
  recordingIds?: string[];
  callTitle?: string;
  onTagsUpdated?: () => void;
}

export default function ManualTagDialog({
  open,
  onOpenChange,
  recordingId,
  recordingIds,
  callTitle,
  onTagsUpdated,
}: ManualTagDialogProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
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
        .from("call_tag_assignments")
        .select("call_recording_id, tag_id")
        .in("call_recording_id", numericRecordingIds);

      if (error) throw error;

      if (isBulkMode) {
        // For bulk mode, show tags that ALL selected calls have in common
        const tagCounts = new Map<string, number>();
        data?.forEach(assignment => {
          const count = tagCounts.get(assignment.tag_id) || 0;
          tagCounts.set(assignment.tag_id, count + 1);
        });

        // Only pre-select tags that ALL calls have
        const commonTags = new Set<string>();
        tagCounts.forEach((count, tagId) => {
          if (count === numericRecordingIds.length) {
            commonTags.add(tagId);
          }
        });

        setSelectedTags(commonTags);
      } else {
        // For single mode, show all assigned tags
        const assigned = new Set(data?.map(a => a.tag_id) || []);
        setSelectedTags(assigned);
      }
    } catch (error) {
      logger.error("Error loading assignments", error);
    } finally {
      setLoading(false);
    }
  }, [targetRecordingIds, isBulkMode]);

  useEffect(() => {
    if (open && targetRecordingIds.length > 0) {
      loadTags();
      // Always load existing assignments to show what's currently assigned
      loadExistingAssignments();
    }
  }, [open, targetRecordingIds.length, loadExistingAssignments]);

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      logger.error("Error loading tags", error);
    }
  };

  const toggleTag = (tagId: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTags(newSelected);
  };

  const handleSave = async () => {
    if (targetRecordingIds.length === 0) return;

    setSaving(true);
    try {
      const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));

      // Get existing assignments for all selected recordings
      const { data: existingAssignments, error: fetchError } = await supabase
        .from("call_tag_assignments")
        .select("call_recording_id, tag_id")
        .in("call_recording_id", numericRecordingIds);

      if (fetchError) throw fetchError;

      // Create a map of existing assignments by recording_id
      const existingByRecording = new Map<number, Set<string>>();
      existingAssignments?.forEach(assignment => {
        if (!existingByRecording.has(assignment.call_recording_id)) {
          existingByRecording.set(assignment.call_recording_id, new Set());
        }
        existingByRecording.get(assignment.call_recording_id)!.add(assignment.tag_id);
      });

      // Determine which assignments to delete and which to add
      const assignmentsToDelete: Array<{call_recording_id: number, tag_id: string}> = [];
      const assignmentsToAdd: Array<{call_recording_id: number, tag_id: string, auto_assigned: boolean}> = [];

      numericRecordingIds.forEach(recordingId => {
        const existing = existingByRecording.get(recordingId) || new Set();

        // Find tags to delete (were selected before but not now)
        existing.forEach(tagId => {
          if (!selectedTags.has(tagId)) {
            assignmentsToDelete.push({ call_recording_id: recordingId, tag_id: tagId });
          }
        });

        // Find tags to add (selected now but weren't before)
        selectedTags.forEach(tagId => {
          if (!existing.has(tagId)) {
            assignmentsToAdd.push({
              call_recording_id: recordingId,
              tag_id: tagId,
              auto_assigned: false,
            });
          }
        });
      });

      // Delete removed assignments
      if (assignmentsToDelete.length > 0) {
        for (const assignment of assignmentsToDelete) {
          await supabase
            .from("call_tag_assignments")
            .delete()
            .eq("call_recording_id", assignment.call_recording_id)
            .eq("tag_id", assignment.tag_id);
        }
      }

      // Insert new assignments
      if (assignmentsToAdd.length > 0) {
        const { error } = await supabase
          .from("call_tag_assignments")
          .insert(assignmentsToAdd);

        if (error) throw error;
      }

      const count = targetRecordingIds.length;
      toast.success(`Tags updated for ${count} meeting${count > 1 ? 's' : ''}`);
      onTagsUpdated?.();
      onOpenChange(false);
    } catch (error) {
      logger.error("Error saving tags", error);
      toast.error("Failed to update tags");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag {isBulkMode ? 'Meetings' : 'Call'}</DialogTitle>
          <DialogDescription>
            {isBulkMode ? (
              <span className="block text-sm font-medium mt-1">
                Applying tags to {targetRecordingIds.length} meetings
              </span>
            ) : (
              callTitle && <span className="block text-sm font-medium mt-1">{callTitle}</span>
            )}
            Select the tags to apply
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : tags.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No tags yet. Create tags first.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center space-x-2">
                <Checkbox
                  id={tag.id}
                  checked={selectedTags.has(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <Label
                  htmlFor={tag.id}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {tag.name}
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
