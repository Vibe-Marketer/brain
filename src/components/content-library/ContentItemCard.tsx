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
 */
function getContentTypeBadgeClass(type: ContentType): string {
  switch (type) {
    case "email":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "social":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "testimonial":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "insight":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "other":
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
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
      <Card className="hover:shadow-md transition-shadow group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
              <CardTitle className="text-base font-medium truncate">{item.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={`${badgeClass}`} variant="outline">
                {item.content_type}
              </Badge>
              {/* Action buttons - visible on hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopy}
                  disabled={isCopying}
                  title="Copy to clipboard"
                >
                  <RiFileCopyLine className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  title="Delete"
                  className="hover:text-destructive"
                >
                  <RiDeleteBinLine className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Content preview */}
          <p className="text-sm text-muted-foreground line-clamp-3">
            {truncateContent(item.content)}
          </p>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer: usage count and date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Used {item.usage_count} {item.usage_count === 1 ? "time" : "times"}</span>
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
