import { useEffect } from "react";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import { RiLoader2Line, RiFileTextLine, RiMailLine, RiChat3Line, RiLightbulbLine, RiMoreLine } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentFilterBar } from "./ContentFilterBar";
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

/**
 * Content item card component - simplified version for initial page
 * Full version with actions will be created in subtask-5-3
 */
function ContentItemCard({ item }: { item: ContentLibraryItem }) {
  const Icon = getContentTypeIcon(item.content_type);
  const badgeClass = getContentTypeBadgeClass(item.content_type);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-base font-medium truncate">{item.title}</CardTitle>
          </div>
          <Badge className={`shrink-0 ${badgeClass}`} variant="outline">
            {item.content_type}
          </Badge>
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
  );
}

/**
 * Content Library Browser Page
 *
 * Displays all content library items with loading, error, and empty states.
 * Following the pattern from AnalyticsTab.tsx.
 */
export function ContentLibraryPage() {
  const items = useContentLibraryStore((state) => state.items);
  const isLoading = useContentLibraryStore((state) => state.itemsLoading);
  const error = useContentLibraryStore((state) => state.itemsError);
  const fetchItems = useContentLibraryStore((state) => state.fetchItems);
  const fetchTags = useContentLibraryStore((state) => state.fetchTags);

  // Fetch items and tags on mount
  useEffect(() => {
    fetchItems();
    fetchTags();
  }, [fetchItems, fetchTags]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RiLoader2Line className="w-8 h-8 animate-spin text-vibe-orange" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-cb-gray-dark dark:text-cb-gray-light">
          Failed to load content library. Please try again.
        </p>
      </div>
    );
  }

  // Empty state
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RiFileTextLine className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg text-cb-gray-dark dark:text-cb-gray-light">
          No content saved yet
        </p>
        <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
          Save generated content to build your library
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-8" />

      {/* Page header */}
      <div className="px-4 mb-6">
        <h1 className="font-display text-2xl font-bold text-cb-black dark:text-cb-white">
          Content Library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} {items.length === 1 ? "item" : "items"} saved
        </p>
      </div>

      {/* Filter bar */}
      <div className="px-4 mb-4">
        <ContentFilterBar />
      </div>

      <Separator className="my-6" />

      {/* Content grid */}
      <div className="px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ContentItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ContentLibraryPage;
