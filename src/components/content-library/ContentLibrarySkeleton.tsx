import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentItemCardSkeleton } from "./ContentItemCardSkeleton";

interface ContentLibrarySkeletonProps {
  /** Number of skeleton cards to display */
  cardCount?: number;
}

/**
 * Skeleton loading state for ContentLibraryPage
 *
 * Matches the full page layout including header, filter bar, and content grid.
 */
export function ContentLibrarySkeleton({ cardCount = 6 }: ContentLibrarySkeletonProps) {
  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-8" />

      {/* Page header skeleton */}
      <div className="px-4 mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Filter bar skeleton */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <Separator className="my-6" />

      {/* Content grid skeleton */}
      <div className="px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: cardCount }).map((_, i) => (
            <ContentItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ContentLibrarySkeleton;
