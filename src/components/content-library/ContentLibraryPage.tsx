import { useEffect } from "react";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import { useBankContext } from "@/hooks/useBankContext";
import { RiFileTextLine } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";
import { AppShell } from "@/components/layout/AppShell";
import { ContentFilterBar } from "./ContentFilterBar";
import { ContentItemCard } from "./ContentItemCard";
import { ContentLibrarySkeleton } from "./ContentLibrarySkeleton";

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
  const { activeBankId } = useBankContext();

  // Fetch items and tags on mount and when bank changes
  useEffect(() => {
    fetchItems(undefined, activeBankId);
    fetchTags(activeBankId);
  }, [fetchItems, fetchTags, activeBankId]);

  // Loading state - show skeleton for smooth UX
  if (isLoading) {
    return (
      <AppShell>
        <ContentLibrarySkeleton />
      </AppShell>
    );
  }

  // Error state
  if (error) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center py-20">
          <p className="text-muted-foreground">
            Failed to load content library. Please try again.
          </p>
        </div>
      </AppShell>
    );
  }

  // Empty state
  if (!items || items.length === 0) {
    return (
      <AppShell>
        <div className="h-full flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <RiFileTextLine className="h-4 w-4 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                  CONTENT LIBRARY
                </h2>
                <p className="text-xs text-ink-muted">Saved generated content</p>
              </div>
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4 p-6 text-center">
            <RiFileTextLine className="w-12 h-12 text-muted-foreground" />
            <p className="text-lg text-foreground">No content saved yet</p>
            <p className="text-sm text-muted-foreground">
              Save generated content to build your library
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiFileTextLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                CONTENT LIBRARY
              </h2>
              <p className="text-xs text-ink-muted">
                {items.length} {items.length === 1 ? "item" : "items"} saved
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-4">
            <ContentFilterBar />
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <ContentItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default ContentLibraryPage;
