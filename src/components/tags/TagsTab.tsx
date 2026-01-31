import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanelStore } from "@/stores/panelStore";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { RiPencilLine, RiFileCopyLine, RiDeleteBinLine, RiPriceTag3Line, RiLoader4Line } from "@remixicon/react";
import { toast } from "sonner";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useListKeyboardNavigationWithState } from "@/hooks/useListKeyboardNavigation";

interface Tag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  is_system: boolean | null;
}

export function TagsTab() {
  const { openPanel, panelData, panelType } = usePanelStore();
  const queryClient = useQueryClient();
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingTagId, setDuplicatingTagId] = useState<string | null>(null);

  // Track selected tag for visual highlighting
  const selectedTagId = panelType === 'tag-detail' ? panelData?.tagId : null;

  const handleTagClick = (tag: Tag) => {
    openPanel('tag-detail', { tagId: tag.id });
  };

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
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
    },
    onError: () => {
      toast.error("Failed to delete tag");
    },
  });

  // Duplicate tag mutation
  const duplicateTagMutation = useMutation({
    mutationFn: async (tag: Tag) => {
      const { data, error } = await supabase
        .from("call_tags")
        .insert({
          name: `Copy of ${tag.name}`,
          color: tag.color,
          description: tag.description,
          is_system: false, // Duplicated tags are always custom
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-tags"] });
      toast.success("Tag duplicated successfully");
    },
    onError: () => {
      toast.error("Failed to duplicate tag");
    },
  });

  const handleDeleteTag = async () => {
    if (!deleteConfirmTag) return;
    setIsDeleting(true);
    try {
      await deleteTagMutation.mutateAsync(deleteConfirmTag.id);
      setDeleteConfirmTag(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateTag = async (tag: Tag) => {
    setDuplicatingTagId(tag.id);
    try {
      await duplicateTagMutation.mutateAsync(tag);
    } finally {
      setDuplicatingTagId(null);
    }
  };

  // Fetch tags
  const { data: tags, isLoading, error: tagsError } = useQuery({
    queryKey: ["call-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name, color, description, is_system")
        .order("name");

      if (error) throw error;
      return data as Tag[];
    },
  });

  // Fetch tag usage counts
  const { data: tagCounts } = useQuery({
    queryKey: ["tag-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select("tag_id");

      if (error) throw error;

      // Count by tag
      const counts: Record<string, number> = {};
      (data || []).forEach((assignment) => {
        counts[assignment.tag_id] = (counts[assignment.tag_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Get the currently selected tag object
  const selectedTag = useMemo(() => {
    if (!selectedTagId || !tags) return null;
    return tags.find(t => t.id === selectedTagId) || null;
  }, [selectedTagId, tags]);

  // --- Keyboard Shortcuts ---
  // Cmd+E: Edit selected tag (open detail panel)
  const handleEditShortcut = useCallback(() => {
    if (selectedTag) {
      openPanel('tag-detail', { tagId: selectedTag.id });
    }
  }, [selectedTag, openPanel]);

  // Cmd+Backspace: Delete selected tag (non-system tags only)
  const handleDeleteShortcut = useCallback(() => {
    if (selectedTag && !selectedTag.is_system) {
      setDeleteConfirmTag(selectedTag);
    }
  }, [selectedTag]);

  // Register keyboard shortcuts
  useKeyboardShortcut(handleEditShortcut, { key: 'e', enabled: !!selectedTag });
  useKeyboardShortcut(handleDeleteShortcut, { key: 'Backspace', enabled: !!selectedTag && !selectedTag.is_system });

  // Keyboard navigation for tag list
  const { focusedId, getRowRef, handleRowClick } = useListKeyboardNavigationWithState({
    items: tags || [],
    getItemId: (tag) => tag.id,
    selectedId: selectedTagId,
    onSelect: handleTagClick,
    enabled: !deleteConfirmTag, // Disable when delete dialog is open
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Description skeleton */}
        <Skeleton className="h-4 w-3/4" />

        {/* Table skeleton */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
                <TableHead className="font-medium text-xs uppercase tracking-wider w-12">
                  Color
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider">
                  Description
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider w-24">
                  Type
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider w-20 text-right">
                  Calls
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-6 w-6 rounded-sm" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-6 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (tagsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <RiPriceTag3Line className="h-8 w-8 text-destructive/50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Failed to load tags</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          There was an error loading your tags. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        These are the system-wide tags that classify calls by type. Tags control which AI prompts
        and analysis run on each call.
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
              <TableHead className="font-medium text-xs uppercase tracking-wider w-12">
                Color
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider">
                Description
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-24">
                Type
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-20 text-right">
                Calls
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!tags || tags.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <RiPriceTag3Line className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No tags yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                      Tags classify your calls and control which AI prompts run on each call.
                      Click on a tag to edit its settings.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {tags?.map((tag) => {
              const isSelected = selectedTagId === tag.id;
              const isFocused = focusedId === tag.id;
              return (
                <ContextMenu key={tag.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      ref={getRowRef(tag.id) as React.Ref<HTMLTableRowElement>}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-hover dark:bg-cb-hover-dark"
                          : isFocused
                          ? "bg-hover/30 dark:bg-cb-hover-dark/30 ring-1 ring-inset ring-vibe-orange/50"
                          : "hover:bg-hover/50 dark:hover:bg-cb-hover-dark/50"
                      }`}
                      onClick={() => {
                        handleRowClick(tag);
                        handleTagClick(tag);
                      }}
                    >
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded-sm"
                          style={{ backgroundColor: tag.color || "#666" }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{tag.name}</TableCell>
                      <TableCell className="text-ink-muted">
                        {tag.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tag.is_system ? "secondary" : "outline"}>
                          {tag.is_system ? "System" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tagCounts?.[tag.id] || 0}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleTagClick(tag)}>
                      <RiPencilLine className="h-4 w-4 mr-2" />
                      Edit
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleDuplicateTag(tag)}
                      disabled={duplicatingTagId === tag.id}
                    >
                      {duplicatingTagId === tag.id ? (
                        <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RiFileCopyLine className="h-4 w-4 mr-2" />
                      )}
                      {duplicatingTagId === tag.id ? "Duplicating..." : "Duplicate"}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => setDeleteConfirmTag(tag)}
                      className="text-destructive focus:text-destructive"
                      disabled={tag.is_system ?? false}
                    >
                      <RiDeleteBinLine className="h-4 w-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmTag}
        onOpenChange={(open) => !open && setDeleteConfirmTag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmTag?.name}&quot;? This action cannot be undone.
              Calls with this tag will no longer have it assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
