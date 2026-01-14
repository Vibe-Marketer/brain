import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for ContentHub stats cards
 *
 * Matches the layout of the stats cards grid on the Content Hub overview page.
 */
export function ContentHubStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Stats card skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            {/* Icon skeleton */}
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-2">
              {/* Number skeleton */}
              <Skeleton className="h-7 w-12" />
              {/* Label skeleton */}
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContentHubStatsSkeleton;
