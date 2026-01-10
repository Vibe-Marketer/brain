/**
 * SearchResults Component
 *
 * Container component that displays search results sorted by relevance score.
 * Features:
 * - Sorts results by relevance score (descending)
 * - Displays each result with relevance percentage
 * - Handles empty and loading states
 */

import React, { useMemo } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchResultItem } from './SearchResultItem';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/types/search';

export interface SearchResultsProps {
  /** Array of search results to display */
  results: SearchResult[];
  /** Whether results are loading */
  isLoading?: boolean;
  /** Callback when a result is clicked */
  onResultClick?: (result: SearchResult) => void;
  /** Custom class name for the container */
  className?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether to show relevance scores */
  showRelevanceScores?: boolean;
}

/**
 * Skeleton loading state for search results
 */
const SearchResultSkeleton: React.FC = () => (
  <div className="flex items-start gap-3 p-3">
    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
);

/**
 * Empty state when no results found
 */
const EmptyState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="py-12 text-center">
    <RiSearchLine className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
    <p className="text-sm text-gray-500 dark:text-gray-400">
      {message || 'No results found'}
    </p>
  </div>
);

/**
 * Sort results by relevance score in descending order
 * Results with no confidence score are placed at the end
 */
function sortByRelevance(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    const scoreA = a.metadata?.confidence ?? 0;
    const scoreB = b.metadata?.confidence ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * SearchResults Component
 *
 * Displays a list of search results sorted by relevance score.
 * Each result shows a percentage relevance score (0-100%).
 *
 * @example
 * ```tsx
 * <SearchResults
 *   results={searchResults}
 *   isLoading={isSearching}
 *   onResultClick={(result) => handleResultClick(result)}
 * />
 * ```
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading = false,
  onResultClick,
  className,
  emptyMessage,
  showRelevanceScores = true,
}) => {
  // Sort results by relevance score (descending)
  const sortedResults = useMemo(() => sortByRelevance(results), [results]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('divide-y divide-gray-100 dark:divide-gray-800', className)}>
        <SearchResultSkeleton />
        <SearchResultSkeleton />
        <SearchResultSkeleton />
      </div>
    );
  }

  // Empty state
  if (sortedResults.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  // Results list
  return (
    <div className={cn('divide-y divide-gray-100 dark:divide-gray-800', className)}>
      {sortedResults.map((result) => (
        <SearchResultItem
          key={result.id}
          result={result}
          onClick={onResultClick}
        />
      ))}
    </div>
  );
};

export default SearchResults;
