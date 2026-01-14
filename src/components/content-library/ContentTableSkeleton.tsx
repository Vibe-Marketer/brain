import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ContentTableSkeletonProps {
  /** Number of skeleton rows to display */
  rowCount?: number;
  /** Number of columns in the table */
  columnCount?: number;
  /** Optional column widths for better skeleton matching */
  columnWidths?: string[];
}

/**
 * Skeleton loading state for table-based content library pages
 *
 * Matches the layout of HooksLibrary, PostsLibrary, and EmailsLibrary tables.
 * Shows header, filters, and table rows as skeletons during loading.
 */
export function ContentTableSkeleton({
  rowCount = 5,
  columnCount = 6,
  columnWidths,
}: ContentTableSkeletonProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header skeleton - standardized detail pane pattern */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-hidden">
        {/* Filters skeleton */}
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>

        {/* Table skeleton */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: columnCount }).map((_, i) => (
                  <TableHead
                    key={i}
                    className={columnWidths?.[i]}
                  >
                    <Skeleton className="h-4 w-full" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: columnCount }).map((_, colIndex) => (
                    <TableCell
                      key={colIndex}
                      className={columnWidths?.[colIndex]}
                    >
                      <Skeleton
                        className={cn(
                          "h-4",
                          // Vary the width for visual interest
                          colIndex === 0 ? "w-8" :
                          colIndex % 2 === 0 ? "w-3/4" : "w-full"
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// Import cn helper
import { cn } from "@/lib/utils";

export default ContentTableSkeleton;
