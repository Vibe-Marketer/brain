import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { FilterButton } from "@/components/transcript-library/FilterButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RiFilter3Line, RiPriceTag3Line, RiCloseLine } from "@remixicon/react";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import type { ContentType, ContentLibraryFilters } from "@/types/content-library";

/**
 * Content type options for the filter dropdown
 */
const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "testimonial", label: "Testimonial" },
  { value: "insight", label: "Insight" },
  { value: "other", label: "Other" },
];

/**
 * Get display label for a content type
 */
function getContentTypeLabel(type: ContentType): string {
  const option = CONTENT_TYPE_OPTIONS.find((opt) => opt.value === type);
  return option?.label ?? type;
}

interface ContentFilterBarProps {
  /**
   * Optional compact mode - hides some labels on mobile
   */
  compact?: boolean;
}

/**
 * Tag Filter Popover Component
 *
 * Multi-select popover for filtering by tags.
 * Follows the pattern from transcript-library/TagFilterPopover.tsx
 */
function TagFilterPopover({
  selectedTags = [],
  availableTags,
  onTagsChange,
}: {
  selectedTags?: string[];
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
}) {
  const handleTagToggle = (tag: string, checked: boolean) => {
    if (checked) {
      onTagsChange([...selectedTags, tag]);
    } else {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiPriceTag3Line className="h-3.5 w-3.5" />}
          label="Tags"
          count={selectedTags.length}
          active={selectedTags.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-white dark:bg-card" align="start">
        <div className="space-y-0">
          <div className="p-4 pb-3">
            <div className="text-sm font-medium">Filter by Tags</div>
          </div>
          <div className="max-h-[300px] overflow-y-auto px-2 pb-2">
            {!availableTags || availableTags.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center px-2">
                No tags available.
              </div>
            ) : (
              <div className="space-y-2 px-2">
                {availableTags.map((tag) => (
                  <div key={tag} className="flex items-center gap-2">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={(checked) => handleTagToggle(tag, !!checked)}
                    />
                    <label
                      htmlFor={`tag-${tag}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {tag}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Content Type Filter Component
 *
 * Dropdown select for filtering by content type.
 */
function ContentTypeFilter({
  selectedType,
  onTypeChange,
}: {
  selectedType?: ContentType;
  onTypeChange: (type: ContentType | undefined) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <Select
      value={selectedType ?? "all"}
      onValueChange={(value) => {
        onTypeChange(value === "all" ? undefined : (value as ContentType));
      }}
    >
      <SelectTrigger
        className={cn(
          "h-8 text-xs bg-cb-black dark:bg-white text-white dark:text-cb-black hover:bg-hover dark:hover:bg-gray-100 border-none",
          isMobile ? "w-[100px]" : "w-[130px]",
          selectedType && "ring-2 ring-vibe-orange ring-offset-2"
        )}
      >
        <RiFilter3Line className="h-3.5 w-3.5 mr-1.5" />
        <SelectValue placeholder="All Types" />
      </SelectTrigger>
      <SelectContent className="bg-white dark:bg-card">
        <SelectItem value="all">All Types</SelectItem>
        {CONTENT_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Content Filter Bar Component
 *
 * Filter bar for the content library with type and tag filters.
 * Follows patterns from transcript-library/FilterBar.tsx
 */
export function ContentFilterBar({ compact = false }: ContentFilterBarProps) {
  const isMobile = useIsMobile();

  // Get filter state and actions from store
  const filters = useContentLibraryStore((state) => state.filters);
  const updateFilters = useContentLibraryStore((state) => state.updateFilters);
  const clearFilters = useContentLibraryStore((state) => state.clearFilters);
  const fetchItems = useContentLibraryStore((state) => state.fetchItems);
  const availableTags = useContentLibraryStore((state) => state.availableTags);

  // Check if any filters are active
  const hasActiveFilters =
    filters.content_type !== undefined ||
    (filters.tags && filters.tags.length > 0);

  // Handle content type change
  const handleTypeChange = (type: ContentType | undefined) => {
    const newFilters: ContentLibraryFilters = {
      ...filters,
      content_type: type,
    };
    updateFilters(newFilters);
    fetchItems(newFilters);
  };

  // Handle tags change
  const handleTagsChange = (tags: string[]) => {
    const newFilters: ContentLibraryFilters = {
      ...filters,
      tags: tags.length > 0 ? tags : undefined,
    };
    updateFilters(newFilters);
    fetchItems(newFilters);
  };

  // Handle clear all filters
  const handleClearAll = () => {
    clearFilters();
    fetchItems({});
  };

  return (
    <div
      className={cn(
        "flex gap-2 flex-wrap",
        isMobile ? "flex-col h-auto" : "items-center h-10"
      )}
    >
      {/* Filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Content Type Filter */}
        <ContentTypeFilter
          selectedType={filters.content_type}
          onTypeChange={handleTypeChange}
        />

        {/* Tag Filter */}
        <TagFilterPopover
          selectedTags={filters.tags}
          availableTags={availableTags}
          onTagsChange={handleTagsChange}
        />

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleClearAll}
          >
            <RiCloseLine className="h-3.5 w-3.5" />
            {!isMobile && <span>Clear</span>}
          </Button>
        )}
      </div>

      {/* Active filter pills (desktop only) */}
      {!isMobile && !compact && hasActiveFilters && (
        <div className="flex items-center gap-2 ml-auto">
          {filters.content_type && (
            <span className="text-xs text-muted-foreground">
              Type: <span className="font-medium">{getContentTypeLabel(filters.content_type)}</span>
            </span>
          )}
          {filters.tags && filters.tags.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Tags: <span className="font-medium">{filters.tags.join(", ")}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ContentFilterBar;
