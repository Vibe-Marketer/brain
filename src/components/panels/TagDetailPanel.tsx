import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  RiPhoneLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiLockLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { tagSchema } from "@/lib/validations";
import { usePanelStore } from "@/stores/panelStore";
import { logger } from "@/lib/logger";
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

interface Tag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  is_system: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface TagDetailPanelProps {
  tagId: string;
  onTagUpdated?: () => void;
  onTagDeleted?: () => void;
}

// Predefined color options for tag color picker
const TAG_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
];

export function TagDetailPanel({
  tagId,
  onTagUpdated,
  onTagDeleted,
}: TagDetailPanelProps) {
  const queryClient = useQueryClient();
  const { closePanel, togglePin, isPinned } = usePanelStore();

  // Fetch the tag
  const { data: tag, isLoading } = useQuery({
    queryKey: ["call-tags", tagId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name, color, description, is_system, created_at, updated_at")
        .eq("id", tagId)
        .single();

      if (error) throw error;
      return data as Tag;
    },
  });

  // Fetch tag usage count
  const { data: callCount = 0 } = useQuery({
    queryKey: ["tag-count", tagId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("call_tag_assignments")
        .select("*", { count: "exact", head: true })
        .eq("tag_id", tagId);

      if (error) throw error;
      return count || 0;
    },
  });

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize form with tag data
  useEffect(() => {
    if (tag) {
      setName(tag.name || "");
      setDescription(tag.description || "");
      setColor(tag.color || "#6B7280");
      setHasChanges(false);
    }
  }, [tag]);

  // Track changes
  useEffect(() => {
    if (!tag) return;

    const nameChanged = name !== tag.name;
    const descChanged = description !== (tag.description || "");
    const colorChanged = color !== (tag.color || "#6B7280");

    setHasChanges(nameChanged || descChanged || colorChanged);
  }, [tag, name, description, color]);

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async (updates: Partial<Tag>) => {
      const { error } = await supabase
        .from("call_tags")
        .update(updates)
        .eq("id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-tags"] });
      queryClient.invalidateQueries({ queryKey: ["call-tags", tagId] });
      toast.success("Tag updated successfully");
      setHasChanges(false);
      onTagUpdated?.();
    },
    onError: (error) => {
      logger.error("Error updating tag", error);
      toast.error("Failed to update tag");
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("call_tags")
        .delete()
        .eq("id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-tags"] });
      queryClient.invalidateQueries({ queryKey: ["tag-counts"] });
      toast.success("Tag deleted successfully");
      closePanel();
      onTagDeleted?.();
    },
    onError: (error) => {
      logger.error("Error deleting tag", error);
      toast.error("Failed to delete tag");
    },
  });

  const handleSave = async () => {
    if (!tag) return;

    const validation = tagSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid tag name");
      return;
    }

    setSaving(true);
    try {
      await updateTagMutation.mutateAsync({
        name: validation.data.name,
        description: validation.data.description || null,
        color,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tag) return;

    setIsDeleting(true);
    try {
      await deleteTagMutation.mutateAsync();
      setDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Determine if tag is editable (non-system tags only)
  const isEditable = useMemo(() => !tag?.is_system, [tag]);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Tag not found
  if (!tag) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-cb-ink">Tag Not Found</h3>
          <Button variant="ghost" size="sm" onClick={closePanel}>
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-cb-ink-muted">
          The selected tag could not be found. It may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col"
      role="region"
      aria-label={`Tag details: ${tag.name}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-cb-border">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${tag.color || "#6B7280"}20` }}
            aria-hidden="true"
          >
            <div
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: tag.color || "#6B7280" }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-cb-ink truncate" id="tag-panel-title">{tag.name}</h3>
              {tag.is_system && (
                <Badge variant="secondary" className="flex-shrink-0">
                  <RiLockLine className="h-3 w-3 mr-1" aria-hidden="true" />
                  System
                </Badge>
              )}
            </div>
            {tag.description && (
              <p className="text-xs text-cb-ink-muted truncate">{tag.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" role="toolbar" aria-label="Panel actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            aria-label={isPinned ? "Unpin panel" : "Pin panel"}
            aria-pressed={isPinned}
          >
            {isPinned ? (
              <RiPushpinFill className="h-4 w-4 text-cb-ink" aria-hidden="true" />
            ) : (
              <RiPushpinLine className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={closePanel}
            aria-label="Close panel"
          >
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Tag statistics">
          <div className="bg-cb-card rounded-lg p-3 border border-cb-border" aria-label={`${callCount} calls with this tag`}>
            <div className="flex items-center gap-2 text-cb-ink-muted mb-1">
              <RiPhoneLine className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">Calls</span>
            </div>
            <div className="text-2xl font-semibold text-cb-ink tabular-nums" aria-hidden="true">
              {callCount}
            </div>
          </div>
          <div className="bg-cb-card rounded-lg p-3 border border-cb-border" aria-label={`Created on ${formatDate(tag.created_at)}`}>
            <div className="flex items-center gap-2 text-cb-ink-muted mb-1">
              <RiCalendarLine className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">Created</span>
            </div>
            <div className="text-sm font-medium text-cb-ink" aria-hidden="true">
              {formatDate(tag.created_at)}
            </div>
          </div>
        </div>

        {/* System tag notice */}
        {tag.is_system && (
          <div
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
            role="note"
            aria-label="System tag information"
          >
            <div className="flex items-start gap-2">
              <RiLockLine className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  System Tag
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  This is a system tag and cannot be edited or deleted. System tags are
                  used by the AI to classify calls and control processing behavior.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Form - only for non-system tags */}
        {isEditable && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }} aria-label="Edit tag form">
            <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide" id="edit-tag-heading">
              Edit Tag
            </h4>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                placeholder="e.g., Sales Call"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required="true"
                aria-describedby="tag-name-hint"
              />
              <span id="tag-name-hint" className="sr-only">Enter a name for this tag</span>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="tag-description">Description</Label>
              <Input
                id="tag-description"
                placeholder="Brief description of this tag"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Tag description"
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label id="color-picker-label">Color</Label>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-labelledby="color-picker-label"
                aria-label="Select a color for this tag"
              >
                {TAG_COLORS.map((colorOption) => (
                  <button
                    key={colorOption}
                    type="button"
                    role="radio"
                    aria-checked={color === colorOption}
                    aria-label={`Color ${colorOption}`}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      color === colorOption
                        ? "border-cb-ink scale-110 ring-2 ring-offset-2 ring-cb-ink/20"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: colorOption }}
                    onClick={() => setColor(colorOption)}
                  />
                ))}
              </div>
            </div>
          </form>
        )}

        {/* Metadata */}
        <div className="space-y-2 pt-4 border-t border-cb-border">
          <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide">
            Details
          </h4>
          <div className="text-sm text-cb-ink-muted space-y-1">
            <p>Created: {formatDate(tag.created_at)}</p>
            <p>Updated: {formatDate(tag.updated_at)}</p>
            <p>Type: {tag.is_system ? "System" : "Custom"}</p>
          </div>
        </div>
      </div>

      {/* Footer Actions - only for non-system tags */}
      {isEditable && (
        <footer className="p-4 border-t border-cb-border space-y-2" role="group" aria-label="Tag actions">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving || !name.trim() || !hasChanges}
            aria-busy={saving}
            aria-describedby="save-tag-status"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <span id="save-tag-status" className="sr-only">
            {saving ? "Saving tag changes" : hasChanges ? "Changes ready to save" : "No changes to save"}
          </span>
          <Button
            variant="hollow"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            aria-label={`Delete tag ${tag.name}`}
          >
            <RiDeleteBinLine className="h-4 w-4 mr-2" aria-hidden="true" />
            Delete Tag
          </Button>
        </footer>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent role="alertdialog" aria-labelledby="delete-tag-dialog-title" aria-describedby="delete-tag-dialog-description">
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-tag-dialog-title">Delete Tag</AlertDialogTitle>
            <AlertDialogDescription id="delete-tag-dialog-description">
              Are you sure you want to delete &quot;{tag.name}&quot;? This action
              cannot be undone. Calls with this tag will no longer be tagged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              aria-busy={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TagDetailPanel;
