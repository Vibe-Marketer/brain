import { useEffect } from "react";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import { RiLoader2Line, RiFileTextLine } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";
import { ContentFilterBar } from "./ContentFilterBar";
import { ContentItemCard } from "./ContentItemCard";

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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-sm overflow-auto m-1">
        {/* Top separator for breathing room */}
        <Separator className="mb-8" />

        {/* Page header */}
        <div className="px-4 md:px-10 mb-6">
          <h1 className="font-display text-2xl font-bold text-cb-black dark:text-cb-white">
            Content Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "item" : "items"} saved
          </p>
        </div>

        {/* Filter bar */}
        <div className="px-4 md:px-10 mb-4">
          <ContentFilterBar />
        </div>

        <Separator className="my-6" />

        {/* Content grid */}
        <div className="px-4 md:px-10 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <ContentItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContentLibraryPage;
