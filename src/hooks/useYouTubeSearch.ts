/**
 * useYouTubeSearch - YouTube-specific search, filter, and sort for vault recordings
 *
 * Extends the useRecordingSearch pattern with YouTube-specific sort fields
 * (views, likes) and published-date tie-breaker logic.
 *
 * @pattern youtube-search-hook
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { getYouTubeMetadata } from '@/types/youtube'
import { parseYouTubeDuration } from '@/lib/youtube-utils'
import type { VaultRecording } from '@/hooks/useVaults'

/** YouTube-specific sort fields */
export type YouTubeSortField = 'date' | 'views' | 'likes' | 'duration' | 'title'

/** Sort order (re-exported for convenience) */
export type SortOrder = 'asc' | 'desc'

/** Hook options */
export interface UseYouTubeSearchOptions {
  recordings: VaultRecording[]
}

/** Hook return type */
export interface UseYouTubeSearchReturn {
  /** Current search query (raw, not debounced) */
  searchQuery: string
  /** Set search query */
  setSearchQuery: (query: string) => void
  /** Current sort field */
  sortBy: YouTubeSortField
  /** Set sort field */
  setSortBy: (field: YouTubeSortField) => void
  /** Current sort order */
  sortOrder: SortOrder
  /** Set sort order */
  setSortOrder: (order: SortOrder) => void
  /** Handle sort column click - toggles order if same field, resets to desc if new */
  handleSortChange: (field: YouTubeSortField) => void
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
 * Get the published date timestamp for a recording (for tie-breaking)
 */
function getPublishedTimestamp(recording: VaultRecording): number {
  const dateStr = recording.recording_start_time || recording.created_at
  return new Date(dateStr).getTime()
}

/**
 * useYouTubeSearch - YouTube-specific search/sort extending useRecordingSearch pattern
 *
 * @param options.recordings - Source recordings array from useVaultRecordings
 * @returns Search/filter state + filtered results with YouTube-specific sort fields
 */
export function useYouTubeSearch({ recordings }: UseYouTubeSearchOptions): UseYouTubeSearchReturn {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<YouTubeSortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Debounced search query (300ms)
  const debouncedQuery = useDebouncedValue(searchQuery, 300)

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedQuery.trim() !== '' ||
      sortBy !== 'date' ||
      sortOrder !== 'desc'
    )
  }, [debouncedQuery, sortBy, sortOrder])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSortBy('date')
    setSortOrder('desc')
  }, [])

  // Handle sort column click: toggle order on same field, set desc on new field
  const handleSortChange = useCallback(
    (field: YouTubeSortField) => {
      if (field === sortBy) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(field)
        setSortOrder('desc')
      }
    },
    [sortBy]
  )

  // Filter and sort recordings
  const filteredRecordings = useMemo(() => {
    let result = [...recordings]

    // 1. Search by title (case-insensitive)
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase().trim()
      result = result.filter((r) => r.title.toLowerCase().includes(query))
    }

    // 2. Sort with YouTube-specific fields + published-date tie-breaker
    result.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'date': {
          const dateA = getPublishedTimestamp(a)
          const dateB = getPublishedTimestamp(b)
          comparison = dateA - dateB
          break
        }
        case 'views': {
          const metaA = getYouTubeMetadata(a.source_metadata)
          const metaB = getYouTubeMetadata(b.source_metadata)
          const viewsA = metaA?.youtube_view_count ?? 0
          const viewsB = metaB?.youtube_view_count ?? 0
          comparison = viewsA - viewsB
          break
        }
        case 'likes': {
          const metaA = getYouTubeMetadata(a.source_metadata)
          const metaB = getYouTubeMetadata(b.source_metadata)
          const likesA = metaA?.youtube_like_count ?? 0
          const likesB = metaB?.youtube_like_count ?? 0
          comparison = likesA - likesB
          break
        }
        case 'duration': {
          const metaA = getYouTubeMetadata(a.source_metadata)
          const metaB = getYouTubeMetadata(b.source_metadata)
          const durA = metaA?.youtube_duration
            ? parseYouTubeDuration(metaA.youtube_duration).seconds
            : (a.duration ?? 0)
          const durB = metaB?.youtube_duration
            ? parseYouTubeDuration(metaB.youtube_duration).seconds
            : (b.duration ?? 0)
          comparison = durA - durB
          break
        }
        case 'title': {
          comparison = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
          break
        }
      }

      // Tie-breaker: published date (newer wins = descending)
      if (comparison === 0 && sortBy !== 'date') {
        const dateA = getPublishedTimestamp(a)
        const dateB = getPublishedTimestamp(b)
        // Newer first (descending) for tie-breaking
        comparison = dateB - dateA
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [recordings, debouncedQuery, sortBy, sortOrder])

  return {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    handleSortChange,
    clearFilters,
    hasActiveFilters,
    filteredRecordings,
    totalCount: recordings.length,
    filteredCount: filteredRecordings.length,
  }
}
