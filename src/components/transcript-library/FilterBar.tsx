import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FilterPill } from "./FilterPill";
import { TagFilterPopover } from "./TagFilterPopover";
import { FolderFilterPopover } from "./FolderFilterPopover";
import { ParticipantsFilterPopover } from "./ParticipantsFilterPopover";
import { DurationFilterPopover } from "./DurationFilterPopover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { CalendarInvitee } from "@/types";

interface Folder {
  id: string;
  name: string;
  description: string | null;
}

interface FilterBarProps {
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    participants?: string[];
    durationMin?: number;
    durationMax?: number;
    tags?: string[];
    folders?: string[];
  };
  onFiltersChange: (filters: FilterBarProps['filters']) => void;
  tags: Array<{ id: string; name: string; description?: string | null }>;
  folders: Folder[];
  // Search is now optional - can be handled by parent or removed entirely
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onCreateFolder?: () => void;
  // Compact mode for when search is in page header
  compact?: boolean;
}

export function FilterBar({
  filters,
  onFiltersChange,
  tags,
  folders,
  searchQuery,
  onSearchChange,
  onCreateFolder,
  compact = false,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [allParticipants, setAllParticipants] = useState<string[]>([]);

  // Fetch all unique participants
  useEffect(() => {
    // Track if component is still mounted to prevent state updates after unmount
    let isMounted = true;

    const fetchParticipants = async () => {
      try {
        // Use safe destructuring to handle network errors
        const userResponse = await supabase.auth.getUser();

        // Check for errors in the response (network issues, etc.)
        if (userResponse.error) {
          logger.warn("Error getting user for participants fetch", userResponse.error);
          return;
        }

        const user = userResponse.data?.user;
        if (!user) return;

        const { data, error: fetchError } = await supabase
          .from("fathom_calls")
          .select("calendar_invitees")
          .eq("user_id", user.id);

        if (fetchError) {
          if (isMounted) {
            logger.error("Error fetching participants data", fetchError);
          }
          return;
        }

        if (isMounted && data) {
          const participantsSet = new Set<string>();
          data.forEach((call: { calendar_invitees?: CalendarInvitee[] | null }) => {
            if (call.calendar_invitees && Array.isArray(call.calendar_invitees)) {
              call.calendar_invitees.forEach((invitee) => {
                if (invitee?.email) participantsSet.add(invitee.email);
              });
            }
          });
          setAllParticipants(Array.from(participantsSet).sort());
        }
      } catch (error) {
        // Only log errors if component is still mounted
        if (isMounted) {
          logger.error("Error fetching participants", error);
        }
      }
    };
    fetchParticipants();

    // Cleanup: mark as unmounted to prevent state updates
    return () => {
      isMounted = false;
    };
  }, []);

  const formatDateRange = (from?: Date, to?: Date) => {
    if (from && to) {
      return `${format(from, "MMM d")} - ${format(to, "MMM d")}`;
    }
    if (from) return `From ${format(from, "MMM d")}`;
    if (to) return `Until ${format(to, "MMM d")}`;
    return "";
  };

  const formatDuration = (min?: number, max?: number) => {
    if (min && max) {
      return `${min}-${max} min`;
    }
    if (min) return `> ${min} min`;
    if (max) return `< ${max} min`;
    return "";
  };

  const hasActiveFilters =
    (filters.tags && filters.tags.length > 0) ||
    (filters.folders && filters.folders.length > 0) ||
    filters.dateFrom ||
    filters.dateTo ||
    (filters.participants && filters.participants.length > 0) ||
    filters.durationMin ||
    filters.durationMax;

  const handleClearAll = () => {
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      participants: [],
      durationMin: undefined,
      durationMax: undefined,
      tags: [],
      folders: [],
    });
  };

  return (
    <div className={cn(
      "flex gap-2 flex-wrap",
      isMobile ? "flex-col h-auto" : "items-center h-10"
    )}>
      {/* Filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date filter */}
        <DateRangePicker
          dateRange={{ from: filters.dateFrom, to: filters.dateTo }}
          onDateRangeChange={(range) => {
            onFiltersChange({ ...filters, dateFrom: range.from, dateTo: range.to });
          }}
          showQuickSelect={true}
          numberOfMonths={2}
          disableFuture={true}
          placeholder={isMobile ? "" : "Date"}
          align="start"
          triggerClassName={cn(
            isMobile
              ? "h-8 w-8 p-0 justify-center border border-border bg-cb-black dark:bg-white text-white dark:text-cb-black hover:bg-hover dark:hover:bg-gray-100"
              : "h-8 gap-1.5 text-xs bg-cb-black dark:bg-white text-white dark:text-cb-black hover:bg-hover dark:hover:bg-gray-100",
            (filters.dateFrom || filters.dateTo) && !isMobile && "ring-2 ring-cb-black ring-offset-2"
          )}
        />

        {/* Tag Filter */}
        <TagFilterPopover
          selectedTags={filters.tags}
          tags={tags}
          onTagsChange={(tags) => onFiltersChange({ ...filters, tags })}
        />

        {/* Folder Filter */}
        <FolderFilterPopover
          selectedFolders={filters.folders}
          folders={folders}
          onFoldersChange={(folders) => onFiltersChange({ ...filters, folders })}
          onCreateFolder={onCreateFolder}
        />

        {/* Participants Filter */}
        <ParticipantsFilterPopover
          selectedParticipants={filters.participants}
          allParticipants={allParticipants}
          onParticipantsChange={(participants) => onFiltersChange({ ...filters, participants })}
        />

        {/* Duration Filter */}
        <DurationFilterPopover
          durationMin={filters.durationMin}
          durationMax={filters.durationMax}
          onDurationChange={(min, max) => onFiltersChange({ ...filters, durationMin: min, durationMax: max })}
        />
      </div>

      {/* Search bar - only shown if not in compact mode and handlers provided */}
      {!compact && onSearchChange && (
        <div className="w-full">
          <Input
            placeholder="Search"
            value={searchQuery || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 text-xs w-full"
          />
        </div>
      )}

      {/* Clear filters link - aligned right */}
      {hasActiveFilters && (
        <div className="flex items-center ml-auto">
          <Button
            variant="link"
            size="sm"
            onClick={handleClearAll}
            className="h-8 text-xs text-ink-soft hover:text-ink dark:text-cb-text-dark-secondary dark:hover:text-white px-2"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 w-full">
          {filters.tags && filters.tags.length > 0 && (
            <FilterPill
              label="Tags"
              value={`${filters.tags.length} tag${filters.tags.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, tags: [] })}
            />
          )}
          {filters.folders && filters.folders.length > 0 && (
            <FilterPill
              label="Folders"
              value={`${filters.folders.length} folder${filters.folders.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, folders: [] })}
            />
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <FilterPill
              label="Date"
              value={formatDateRange(filters.dateFrom, filters.dateTo)}
              onRemove={() => onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined })}
            />
          )}
          {filters.participants && filters.participants.length > 0 && (
            <FilterPill
              label="Participants"
              value={`${filters.participants.length} participant${filters.participants.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, participants: [] })}
            />
          )}
          {(filters.durationMin || filters.durationMax) && (
            <FilterPill
              label="Duration"
              value={formatDuration(filters.durationMin, filters.durationMax)}
              onRemove={() => onFiltersChange({ ...filters, durationMin: undefined, durationMax: undefined })}
            />
          )}
        </div>
      )}
    </div>
  );
}
