/**
 * useRecordingSearch - Client-side search, filter, and sort for vault recordings
 *
 * Provides debounced title search (300ms), date range filtering, and
 * multi-field sorting for VaultRecording arrays.
 *
 * @pattern client-side-filter-hook
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { VaultRecording } from '@/hooks/useVaults'

/** Sort field options */
export type RecordingSortField = 'date' | 'duration' | 'title'

/** Sort order */
export type SortOrder = 'asc' | 'desc'

/** Date range filter */
export interface DateRange {
  from: string | null // ISO date string (YYYY-MM-DD)
  to: string | null   // ISO date string (YYYY-MM-DD)
}

/** Hook options */
export interface UseRecordingSearchOptions {
  recordings: VaultRecording[]
}

/** Hook return type */
export interface UseRecordingSearchReturn {
  /** Current search query (raw, not debounced) */
  searchQuery: string
  /** Set search query */
  setSearchQuery: (query: string) => void
  /** Current date range filter */
  dateRange: DateRange
  /** Set date range filter */
  setDateRange: (range: DateRange) => void
  /** Current sort field */
  sortBy: RecordingSortField
  /** Set sort field */
  setSortBy: (field: RecordingSortField) => void
  /** Current sort order */
  sortOrder: SortOrder
  /** Set sort order */
  setSortOrder: (order: SortOrder) => void
  /** Reset all filters to defaults */
  clearFilters: () => void
  /** Whether any filter is active */
  hasActiveFilters: boolean
  /** Filtered and sorted recordings */
  filteredRecordings: VaultRecording[]
  /** Total count before filtering */
  totalCount: number
  /** Count after filtering */
  filteredCount: number
}

/**
 * Custom debounce hook that returns a debounced value
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * useRecordingSearch - Search, filter, and sort vault recordings client-side
 *
 * @param options.recordings - Source recordings array from useVaultRecordings
 * @returns Search/filter state + filtered results
 */
export function useRecordingSearch({ recordings }: UseRecordingSearchOptions): UseRecordingSearchReturn {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const [sortBy, setSortBy] = useState<RecordingSortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Debounced search query (300ms)
  const debouncedQuery = useDebouncedValue(searchQuery, 300)

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedQuery.trim() !== '' ||
      dateRange.from !== null ||
      dateRange.to !== null ||
      sortBy !== 'date' ||
      sortOrder !== 'desc'
    )
  }, [debouncedQuery, dateRange, sortBy, sortOrder])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setDateRange({ from: null, to: null })
    setSortBy('date')
    setSortOrder('desc')
  }, [])

  // Filter and sort recordings
  const filteredRecordings = useMemo(() => {
    let result = [...recordings]

    // 1. Search by title (case-insensitive)
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase().trim()
      result = result.filter((r) => r.title.toLowerCase().includes(query))
    }

    // 2. Filter by date range
    if (dateRange.from) {
      const fromDate = new Date(dateRange.from)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter((r) => {
        const recordingDate = new Date(r.recording_start_time || r.created_at)
        return recordingDate >= fromDate
      })
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter((r) => {
        const recordingDate = new Date(r.recording_start_time || r.created_at)
        return recordingDate <= toDate
      })
    }

    // 3. Sort
    result.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'date': {
          const dateA = new Date(a.recording_start_time || a.created_at).getTime()
          const dateB = new Date(b.recording_start_time || b.created_at).getTime()
          comparison = dateA - dateB
          break
        }
        case 'duration': {
          const durA = a.duration ?? 0
          const durB = b.duration ?? 0
          comparison = durA - durB
          break
        }
        case 'title': {
          comparison = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
          break
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [recordings, debouncedQuery, dateRange, sortBy, sortOrder])

  return {
    searchQuery,
    setSearchQuery,
    dateRange,
    setDateRange,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    clearFilters,
    hasActiveFilters,
    filteredRecordings,
    totalCount: recordings.length,
    filteredCount: filteredRecordings.length,
  }
}
