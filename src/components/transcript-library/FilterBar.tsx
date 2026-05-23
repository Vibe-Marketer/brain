// ORG-02 Audit: All filter popover data is org-scoped
// - Tags: useTags(orgId) → getTags(orgId) → .eq('organization_id', orgId) ✓
// - Tag counts: useTagCounts(orgId) → getTagCounts(orgId) → filters by org tag IDs ✓
// - Tag rules: useTagRules(orgId) → getTagRules(orgId) → filters by org tag IDs ✓
// - Contacts: inline query against `contacts` table in FilterBar → .eq('org_id', activeOrganizationId) ✓
// - Sources: useAvailableSources(orgId) → getAvailableSources(orgId) → .eq('organization_id', orgId) ✓
// Phase 35-02: Folder + Duration filter pills removed (FILTER-01, FILTER-02).
// Search-syntax (folder:"X", dur:>15m) still drives those filter values via
// the parent's merging logic in TranscriptsTab.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FilterPill } from "./FilterPill";
import { TagFilterPopover } from "./TagFilterPopover";
import { ContactsFilterPopover } from "./ContactsFilterPopover";
import { SourceFilterPopover } from "./SourceFilterPopover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

interface FilterBarProps {
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    participants?: string[];
    durationMin?: number;
    durationMax?: number;
    tags?: string[];
    folders?: string[];
    sources?: string[];
  };
  onFiltersChange: (filters: FilterBarProps["filters"]) => void;
  tags: Array<{ id: string; name: string; description?: string | null }>;
  // Search is now optional - can be handled by parent or removed entirely
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Dynamic list of source_app values available in the current org/workspace */
  availableSources?: string[];
  // Compact mode for when search is in page header
  compact?: boolean;
}

export function FilterBar({
  filters,
  onFiltersChange,
  tags,
  searchQuery,
  onSearchChange,
  availableSources,
  compact = false,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const { activeOrganizationId } = useOrganizationContext();

  // Phase 35-04 (FILTER-03): Fetch all contacts from the org-scoped `contacts`
  // table (the canonical contacts directory) instead of `call_participants`,
  // so that searching "Phill" returns Phill Tomlinson even before he's been
  // an invitee on any synced call. Same dedupe-by-email behavior is preserved
  // for cases where one contact has multiple rows.
  const { data: allContacts = [] } = useQuery({
    queryKey: ["filter-bar-contacts", activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];

      const { data, error: fetchError } = await supabase
        .from("contacts")
        .select("email, name")
        .eq("org_id", activeOrganizationId)
        .not("email", "is", null)
        .order("name", { ascending: true, nullsFirst: false })
        .limit(1000);

      if (fetchError) {
        logger.error("Error fetching contacts for filter", fetchError);
        return [];
      }

      const contactsMap = new Map<string, string | null>();
      (data ?? []).forEach(
        (row: { email?: string | null; name?: string | null }) => {
          if (!row.email) return;
          if (!contactsMap.has(row.email)) {
            contactsMap.set(row.email, row.name ?? null);
          } else if (row.name && !contactsMap.get(row.email)) {
            // Promote a labelled entry if the original was email-only.
            contactsMap.set(row.email, row.name);
          }
        },
      );
      return Array.from(contactsMap.entries())
        .map(([email, name]) => ({ email, name }))
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
  });

  const formatDateRange = (from?: Date, to?: Date) => {
    if (from && to) {
      return `${format(from, "MMM d")} - ${format(to, "MMM d")}`;
    }
    if (from) return `From ${format(from, "MMM d")}`;
    if (to) return `Until ${format(to, "MMM d")}`;
    return "";
  };

  const hasActiveFilters =
    (filters.tags && filters.tags.length > 0) ||
    (filters.sources && filters.sources.length > 0) ||
    filters.dateFrom ||
    filters.dateTo ||
    (filters.participants && filters.participants.length > 0);

  const handleClearAll = () => {
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      participants: [],
      durationMin: undefined,
      durationMax: undefined,
      tags: [],
      folders: [],
      sources: [],
    });
  };

  return (
    <div className="flex flex-col">
      {/* Row 1 — primary toolbar (never grows past its fixed height on desktop) */}
      <div
        className={cn(
          "flex gap-2",
          isMobile
            ? "flex-wrap h-auto"
            : "items-center h-10 overflow-hidden shrink-0",
        )}
      >
        {/* Filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date filter */}
          <DateRangePicker
            dateRange={{ from: filters.dateFrom, to: filters.dateTo }}
            onDateRangeChange={(range) => {
              onFiltersChange({
                ...filters,
                dateFrom: range.from,
                dateTo: range.to,
              });
            }}
            showQuickSelect={true}
            numberOfMonths={1}
            disableFuture={true}
            placeholder={isMobile ? "" : "Date"}
            align="start"
            triggerClassName={cn(
              isMobile
                ? "h-8 w-8 p-0 justify-center border border-border bg-foreground text-background hover:bg-foreground/90"
                : "h-8 gap-1.5 text-xs bg-foreground text-background hover:bg-foreground/90",
              (filters.dateFrom || filters.dateTo) &&
                !isMobile &&
                "ring-2 ring-foreground ring-offset-2",
            )}
          />

          {/* Tag Filter */}
          <TagFilterPopover
            selectedTags={filters.tags}
            tags={tags}
            onTagsChange={(tags) => onFiltersChange({ ...filters, tags })}
          />

          {/* Contacts Filter */}
          <ContactsFilterPopover
            selectedParticipants={filters.participants}
            allParticipants={allContacts}
            onParticipantsChange={(participants) =>
              onFiltersChange({ ...filters, participants })
            }
          />

          {/* Source Filter */}
          <SourceFilterPopover
            selectedSources={filters.sources}
            onSourcesChange={(sources) =>
              onFiltersChange({ ...filters, sources })
            }
            availableSources={availableSources}
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
      </div>

      {/* Row 2 — active filter pills + clear all (independent row, never disturbs Row 1) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 py-1.5">
          {filters.tags && filters.tags.length > 0 && (
            <FilterPill
              label="Tags"
              value={`${filters.tags.length} tag${filters.tags.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, tags: [] })}
            />
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <FilterPill
              label="Date"
              value={formatDateRange(filters.dateFrom, filters.dateTo)}
              onRemove={() =>
                onFiltersChange({
                  ...filters,
                  dateFrom: undefined,
                  dateTo: undefined,
                })
              }
            />
          )}
          {filters.participants && filters.participants.length > 0 && (
            <FilterPill
              label="Contacts"
              value={`${filters.participants.length} contact${filters.participants.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, participants: [] })}
            />
          )}
          {filters.sources && filters.sources.length > 0 && (
            <FilterPill
              label="Source"
              value={`${filters.sources.length} source${filters.sources.length > 1 ? "s" : ""}`}
              onRemove={() => onFiltersChange({ ...filters, sources: [] })}
            />
          )}
          <Button
            variant="link"
            size="sm"
            onClick={handleClearAll}
            className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
