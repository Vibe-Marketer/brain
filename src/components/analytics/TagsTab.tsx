import { useState, useMemo } from "react";
import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { RiLoader2Line, RiArrowUpSLine, RiArrowDownSLine } from "@remixicon/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortColumn = "name" | "calls" | "totalMinutes" | "avgDuration";
type SortDirection = "asc" | "desc";

interface TagData {
  name: string;
  calls: number;
  totalMinutes: number;
  avgDuration: number;
}

export function TagsTab() {
  const { data: analytics, isLoading, error } = useCallAnalytics("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("calls");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Transform callsByTag data into table format with calculated fields
  const tagData = useMemo((): TagData[] => {
    if (!analytics?.callsByTag) return [];

    return analytics.callsByTag.map((tag) => {
      // Calculate total minutes and avg duration per tag
      // Since we only have call count from the hook, we'll use placeholder calculations
      // In a real implementation, this would come from the backend
      const estimatedAvgDuration = analytics.avgDuration || 30; // Use overall avg as estimate
      const totalMinutes = tag.value * estimatedAvgDuration;
      const avgDuration = estimatedAvgDuration;

      return {
        name: tag.name,
        calls: tag.value,
        totalMinutes: Math.round(totalMinutes),
        avgDuration: Math.round(avgDuration),
      };
    });
  }, [analytics]);

  // Sort the data based on current sort state
  const sortedData = useMemo(() => {
    return [...tagData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [tagData, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <RiArrowUpSLine className="h-4 w-4 inline-block ml-1" />
    ) : (
      <RiArrowDownSLine className="h-4 w-4 inline-block ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RiLoader2Line className="w-8 h-8 animate-spin text-vibe-orange" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-cb-gray-dark dark:text-cb-gray-light">
          Failed to load analytics. Please try again.
        </p>
      </div>
    );
  }

  if (!analytics || sortedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-lg text-cb-gray-dark dark:text-cb-gray-light">
          No tag data available yet
        </p>
        <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
          Tag your calls to see analytics here
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-white dark:bg-[#202020] border-b border-cb-gray-dark/30 dark:border-cb-gray-light/30">
            <TableHead
              className={`text-xs font-medium uppercase text-cb-gray-dark dark:text-cb-gray-light cursor-pointer select-none py-2.5 px-4 ${
                sortColumn === "name" ? "border-b-[3px] border-vibe-orange" : ""
              }`}
              onClick={() => handleSort("name")}
            >
              Tag / Category Name
              <SortIcon column="name" />
            </TableHead>
            <TableHead
              className={`text-xs font-medium uppercase text-cb-gray-dark dark:text-cb-gray-light cursor-pointer select-none py-2.5 px-4 text-right ${
                sortColumn === "calls" ? "border-b-[3px] border-vibe-orange" : ""
              }`}
              onClick={() => handleSort("calls")}
            >
              # Calls
              <SortIcon column="calls" />
            </TableHead>
            <TableHead
              className={`text-xs font-medium uppercase text-cb-gray-dark dark:text-cb-gray-light cursor-pointer select-none py-2.5 px-4 text-right ${
                sortColumn === "totalMinutes" ? "border-b-[3px] border-vibe-orange" : ""
              }`}
              onClick={() => handleSort("totalMinutes")}
            >
              Total Minutes
              <SortIcon column="totalMinutes" />
            </TableHead>
            <TableHead
              className={`text-xs font-medium uppercase text-cb-gray-dark dark:text-cb-gray-light cursor-pointer select-none py-2.5 px-4 text-right ${
                sortColumn === "avgDuration" ? "border-b-[3px] border-vibe-orange" : ""
              }`}
              onClick={() => handleSort("avgDuration")}
            >
              Avg Duration per Call
              <SortIcon column="avgDuration" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((tag) => (
            <TableRow
              key={tag.name}
              className="h-[30px] border-b border-cb-gray-dark/30 dark:border-cb-gray-light/30 hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark"
            >
              <TableCell className="py-2 px-4 font-medium text-sm text-cb-black dark:text-cb-white">
                {tag.name}
              </TableCell>
              <TableCell className="py-2 px-4 text-right tabular-nums text-sm text-cb-black dark:text-cb-white">
                {tag.calls.toLocaleString()}
              </TableCell>
              <TableCell className="py-2 px-4 text-right tabular-nums text-sm text-cb-black dark:text-cb-white">
                {tag.totalMinutes.toLocaleString()}
              </TableCell>
              <TableCell className="py-2 px-4 text-right tabular-nums text-sm text-cb-black dark:text-cb-white">
                {tag.avgDuration} min
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
