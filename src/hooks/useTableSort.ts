import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export function useTableSort<T>(data: T[], initialField: string = "date") {
  const [sortField, setSortField] = useState<string>(initialField);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a: any, b: any) => {
      let aVal, bVal;

      // Handle common field patterns
      if (sortField === "title" || sortField === "display_name") {
        aVal = (a[sortField] || a.title || a.display_name || "").toLowerCase();
        bVal = (b[sortField] || b.title || b.display_name || "").toLowerCase();
      } else if (sortField === "date" || sortField === "created_at") {
        aVal = new Date(a.created_at || a.date).getTime();
        bVal = new Date(b.created_at || b.date).getTime();
      } else if (sortField === "last_login_at") {
        aVal = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        bVal = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      } else if (sortField === "participants") {
        aVal = a.calendar_invitees?.length || 0;
        bVal = b.calendar_invitees?.length || 0;
      } else if (sortField === "duration") {
        aVal = a.recording_start_time && a.recording_end_time
          ? new Date(a.recording_end_time).getTime() - new Date(a.recording_start_time).getTime()
          : 0;
        bVal = b.recording_start_time && b.recording_end_time
          ? new Date(b.recording_end_time).getTime() - new Date(b.recording_start_time).getTime()
          : 0;
      } else {
        // Generic field access
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDirection]);

  return {
    sortField,
    sortDirection,
    sortedData,
    handleSort,
  };
}
