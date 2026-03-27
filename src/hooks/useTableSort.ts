import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

/**
 * Client-side sorting for the current page of data.
 * Note: This sorts only the visible page, not the full dataset.
 * Primary sort order comes from the server query (by date desc).
 * This hook provides secondary column-header sorting as a convenience.
 */
export function useTableSort<T>(data: T[], initialField: string = "date") {
  const [sortField, setSortField] = useState<string>(initialField);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = useCallback((field: string) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        return prevField;
      }
      setSortDirection("desc");
      return field;
    });
  }, []);

  const sortedData = useMemo(() => {
    return [...data].sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      // Handle common field patterns
      if (sortField === "title" || sortField === "display_name") {
        aVal = (a[sortField] || a.title || a.display_name || "").toLowerCase();
        bVal = (b[sortField] || b.title || b.display_name || "").toLowerCase();
      } else if (sortField === "date" || sortField === "created_at" || sortField === "recording_start_time") {
        aVal = new Date(a.recording_start_time || a.created_at || a.date || 0).getTime();
        bVal = new Date(b.recording_start_time || b.created_at || b.date || 0).getTime();
      } else if (sortField === "last_login_at") {
        aVal = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        bVal = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      } else if (sortField === "participants") {
        aVal = a.calendar_invitees?.length || 0;
        bVal = b.calendar_invitees?.length || 0;
      } else if (sortField === "duration") {
        const getDuration = (item: any): number => {
          if (item.source_metadata?.duration_seconds != null) {
            return Number(item.source_metadata.duration_seconds);
          }
          if (item.recording_start_time && item.recording_end_time) {
            return (new Date(item.recording_end_time).getTime() - new Date(item.recording_start_time).getTime()) / 1000;
          }
          return 0;
        };
        aVal = getDuration(a);
        bVal = getDuration(b);
      } else if (sortField === "source") {
        aVal = (a.source_platform || "").toLowerCase();
        bVal = (b.source_platform || "").toLowerCase();
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
