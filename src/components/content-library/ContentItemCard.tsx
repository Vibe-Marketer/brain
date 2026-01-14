import { useState } from "react";
import { RiFileCopyLine, RiDeleteBinLine, RiMailLine, RiChat3Line, RiFileTextLine, RiLightbulbLine, RiMoreLine, RiAlertLine } from "@remixicon/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import type { ContentType, ContentLibraryItem } from "@/types/content-library";

/**
 * Get icon for content type
 */
function getContentTypeIcon(type: ContentType) {
  switch (type) {
    case "email":
      return RiMailLine;
    case "social":
      return RiChat3Line;
    case "testimonial":
      return RiFileTextLine;
    case "insight":
      return RiLightbulbLine;
    case "other":
    default:
      return RiMoreLine;
  }
}

/**
 * Get badge color variant for content type
 * Using semantic status colors per brand guidelines v4.2
 * Subtle backgrounds (2-3% opacity) with high-contrast text
 */
function getContentTypeBadgeClass(type: ContentType): string {
  switch (type) {
    case "email":
      return "bg-info-bg text-info-text border-info-border";
    case "social":
      return "bg-purple/10 text-purple border-purple/30 dark:bg-purple/20 dark:border-purple/40";
    case "testimonial":
      return "bg-success-bg text-success-text border-success-border";
    case "insight":
      return "bg-warning-bg text-warning-text border-warning-border";
    case "other":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Truncate content for preview
 */
function truncateContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + "...";
}

interface ContentItemCardProps {
  item: ContentLibraryItem;
}

/**
 * Content item card component with actions
 *
 * Displays content preview with copy and delete functionality.
 * Copy button copies content to clipboard and increments usage count.
 * Delete button shows confirmation dialog before deleting.
 */
export function ContentItemCard({ item }: ContentItemCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const deleteItem = useContentLibraryStore((state) => state.deleteItem);
  const incrementItemUsage = useContentLibraryStore((state) => state.incrementItemUsage);

  const Icon = getContentTypeIcon(item.content_type);
  const badgeClass = getContentTypeBadgeClass(item.content_type);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = async () => {
    if (isCopying) return;

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(item.content);

      // Increment usage count after successful copy
      await incrementItemUsage(item.id);

      toast.success("Content copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy content");
    } finally {
      setIsCopying(false);
    }
  };

  /**
   * Handle delete confirmation
   */
  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const success = await deleteItem(item.id);

      if (success) {
        toast.success("Content deleted successfully");
        setIsDeleteDialogOpen(false);
      } else {
        toast.error("Failed to delete content");
      }
    } catch (error) {
      toast.error("Failed to delete content");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-all duration-200 group border-border">
        <CardHeader className="pb-2 pt-2.5 px-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-ink-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-ink truncate leading-tight">
                    {item.title}
                  </CardTitle>
                  <Badge className={`${badgeClass} text-[10px] font-medium px-1.5 py-0 shrink-0`} variant="outline">
                    {item.content_type}
                  </Badge>
                </div>
              </div>
            </div>
            {/* Action buttons - visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                disabled={isCopying}
                title="Copy to clipboard"
                className="text-ink-muted hover:text-ink hover:bg-hover"
              >
                <RiFileCopyLine className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isDeleting}
                title="Delete"
                className="text-ink-muted hover:text-destructive hover:bg-destructive/10"
              >
                <RiDeleteBinLine className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3 pt-0">
          {/* Content preview */}
          <p className="text-sm font-light text-ink-soft leading-normal line-clamp-2">
            {truncateContent(item.content)}
          </p>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="hollow" className="text-[9px] font-normal px-1.5 py-0 text-ink-muted">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="hollow" className="text-[9px] font-normal px-1.5 py-0 text-ink-muted">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer: usage count and date */}
          <div className="flex items-center justify-between text-[11px] font-light text-ink-muted pt-2 border-t border-border-soft">
            <span className="tabular-nums">Used {item.usage_count}×</span>
            <span>{formatDate(item.created_at)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <RiAlertLine className="h-5 w-5" />
              <AlertDialogTitle>Delete Content</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left space-y-2">
              <p className="text-foreground">
                Are you sure you want to delete <strong>"{item.title}"</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The content will be permanently removed from your library.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="hollow"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ContentItemCard;
