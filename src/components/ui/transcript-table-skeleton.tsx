import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

interface TranscriptTableSkeletonProps {
  rows?: number;
}

export const TranscriptTableSkeleton = React.memo(({ rows = 5 }: TranscriptTableSkeletonProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3 px-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-0.5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header skeleton */}
          <div className="border-b bg-muted/50 p-4">
            <div className="flex gap-4 items-center">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          
          {/* Rows skeleton */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="border-b p-4 last:border-b-0">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
                <Skeleton className="h-5 w-16" />
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

TranscriptTableSkeleton.displayName = "TranscriptTableSkeleton";
