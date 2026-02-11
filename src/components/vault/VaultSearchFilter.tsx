/**
 * VaultSearchFilter - Search input and filter controls for vault recordings
 *
 * Provides a sticky toolbar with search-by-title, sort dropdown, and clear button.
 * Integrates with useRecordingSearch hook for debounced client-side filtering.
 *
 * @pattern vault-filter-toolbar
 * @brand-version v4.2
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RiSearchLine,
  RiCloseLine,
  RiSortAsc,
  RiSortDesc,
} from '@remixicon/react'
import type { RecordingSortField, SortOrder } from '@/hooks/useRecordingSearch'

export interface VaultSearchFilterProps {
  /** Current search query */
  searchQuery: string
  /** Set search query */
  onSearchChange: (query: string) => void
  /** Current sort field */
  sortBy: RecordingSortField
  /** Set sort field */
  onSortByChange: (field: RecordingSortField) => void
  /** Current sort order */
  sortOrder: SortOrder
  /** Set sort order */
  onSortOrderChange: (order: SortOrder) => void
  /** Whether any filter is active */
  hasActiveFilters: boolean
  /** Clear all filters */
  onClearFilters: () => void
  /** Total recording count */
  totalCount: number
  /** Filtered recording count */
  filteredCount: number
  /** Optional className */
  className?: string
}

/** Sort field display labels */
const SORT_LABELS: Record<RecordingSortField, string> = {
  date: 'Date',
  duration: 'Duration',
  title: 'Title',
}

export function VaultSearchFilter({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  hasActiveFilters,
  onClearFilters,
  totalCount,
  filteredCount,
  className,
}: VaultSearchFilterProps) {
  // Toggle sort order
  const handleToggleSortOrder = useCallback(() => {
    onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')
  }, [sortOrder, onSortOrderChange])

  // Handle sort field change
  const handleSortByChange = useCallback(
    (value: string) => {
      onSortByChange(value as RecordingSortField)
    },
    [onSortByChange]
  )

  const showFilterCount = hasActiveFilters && filteredCount !== totalCount

  return (
    <div
      className={cn(
        'sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40 px-4 py-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <RiSearchLine
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="text"
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 pr-8 text-xs bg-background/50"
            aria-label="Search recordings by title"
          />
          {/* Clear search X button */}
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <RiCloseLine className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort field dropdown */}
        <Select value={sortBy} onValueChange={handleSortByChange}>
          <SelectTrigger
            className="h-8 w-[110px] text-xs bg-background/50 flex-shrink-0"
            aria-label="Sort recordings by"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as RecordingSortField[]).map((field) => (
              <SelectItem key={field} value={field} className="text-xs">
                {SORT_LABELS[field]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort order toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleSortOrder}
          className="h-8 w-8 flex-shrink-0"
          aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
        >
          {sortOrder === 'asc' ? (
            <RiSortAsc className="h-4 w-4" />
          ) : (
            <RiSortDesc className="h-4 w-4" />
          )}
        </Button>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label="Clear all filters"
          >
            <RiCloseLine className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter result count */}
      {showFilterCount && (
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          Showing <span className="font-medium tabular-nums">{filteredCount}</span> of{' '}
          <span className="tabular-nums">{totalCount}</span> recordings
        </div>
      )}
    </div>
  )
}
