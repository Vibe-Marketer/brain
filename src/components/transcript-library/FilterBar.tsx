import { RiDownloadLine, RiEyeLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FilterPill } from "./FilterPill";
import { CategoryFilterPopover } from "./CategoryFilterPopover";
import { ParticipantsFilterPopover } from "./ParticipantsFilterPopover";
import { DurationFilterPopover } from "./DurationFilterPopover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface FilterBarProps {
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    participants?: string[];
    durationMin?: number;
    durationMax?: number;
    categories?: string[];
  };
  onFiltersChange: (filters: any) => void;
  categories: any[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (columnId: string) => void;
  onExport: () => void;
}

const columnOptions = [
  { id: "date", label: "Date" },
  { id: "duration", label: "Duration" },
  { id: "participants", label: "Participants" },
  { id: "categories", label: "Folders" },
  { id: "status", label: "Status" },
];

export function FilterBar({
  filters,
  onFiltersChange,
  categories,
  searchQuery,
  onSearchChange,
  visibleColumns,
  onToggleColumn,
  onExport,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [allParticipants, setAllParticipants] = useState<string[]>([]);

  // Fetch all unique participants
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("fathom_calls")
          .select("calendar_invitees")
          .eq("user_id", user.id);

        if (data) {
          const participantsSet = new Set<string>();
          data.forEach((call: any) => {
            if (call.calendar_invitees) {
              call.calendar_invitees.forEach((invitee: any) => {
                if (invitee.email) participantsSet.add(invitee.email);
              });
            }
          });
          setAllParticipants(Array.from(participantsSet).sort());
        }
      } catch (error) {
        logger.error("Error fetching participants", error);
      }
    };
    fetchParticipants();
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
    (filters.categories && filters.categories.length > 0) ||
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
      categories: [],
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
              ? "h-8 w-8 p-0 justify-center border border-border bg-cb-black dark:bg-white text-white dark:text-cb-black hover:bg-cb-hover dark:hover:bg-gray-100"
              : "h-8 gap-1.5 text-xs bg-cb-black dark:bg-white text-white dark:text-cb-black hover:bg-cb-hover dark:hover:bg-gray-100",
            (filters.dateFrom || filters.dateTo) && !isMobile && "ring-2 ring-cb-black ring-offset-2"
          )}
        />

        {/* Category Filter */}
        <CategoryFilterPopover
          selectedCategories={filters.categories}
          categories={categories}
          onCategoriesChange={(categories) => onFiltersChange({ ...filters, categories })}
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

      {/* Search bar - full width on mobile */}
      <div className="w-full">
        <Input
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 text-xs w-full"
        />
      </div>

      {/* Actions - aligned right */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Clear filters link */}
        {hasActiveFilters && (
          <Button
            variant="link"
            size="sm"
            onClick={handleClearAll}
            className="h-8 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2"
          >
            Clear all
          </Button>
        )}

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="hollow" size="icon-sm" className="h-8 w-8">
              <RiEyeLine className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columnOptions.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={visibleColumns[col.id]}
                onCheckedChange={() => onToggleColumn(col.id)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="hollow" size="icon-sm" className="h-8 w-8">
              <RiDownloadLine className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport}>
              Export visible calls
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 w-full">
          {filters.categories && filters.categories.length > 0 && (
            <FilterPill
              label="Folders"
              value={`${filters.categories.length} folder${filters.categories.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, categories: [] })}
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
