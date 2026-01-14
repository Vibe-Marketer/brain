import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for ContentItemCard
 *
 * Matches the layout of ContentItemCard for smooth transition when content loads.
 */
export function ContentItemCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 pt-2.5 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Icon skeleton */}
            <Skeleton className="w-6 h-6 rounded-md shrink-0" />
            {/* Title and badge skeleton */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-12 shrink-0" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        {/* Content preview skeleton - 2 lines */}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Tags skeleton */}
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-10" />
        </div>

        {/* Footer skeleton: usage count and date */}
        <div className="flex items-center justify-between pt-2 border-t border-border-soft">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
      </CardContent>
    </Card>
  );
}

export default ContentItemCardSkeleton;
