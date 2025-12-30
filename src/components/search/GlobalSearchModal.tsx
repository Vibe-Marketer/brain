/**
 * GlobalSearchModal Component
 *
 * Universal search modal that can be triggered from anywhere in the app.
 * Features:
 * - Cmd/Ctrl+K keyboard shortcut to open
 * - Autofocus on search input
 * - Escape key to close
 * - Loading state with skeleton
 * - Empty state with helpful message
 * - Results list with navigation
 */

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiSearchLine, RiKeyboardBoxLine } from '@remixicon/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchStore } from '@/stores/searchStore';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useSearchShortcut } from '@/hooks/useKeyboardShortcut';
import { SearchResultItem } from './SearchResultItem';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/types/search';

export interface GlobalSearchModalProps {
  /** Custom class name for the modal */
  className?: string;
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
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
);

/**
 * Empty state when no results found
 */
const EmptyState: React.FC<{ query: string }> = ({ query }) => (
  <div className="py-12 text-center">
    <RiSearchLine className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
      No results found
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
      No results found for &quot;{query}&quot;
    </p>
    <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
      <p>Try:</p>
      <ul className="list-disc list-inside">
        <li>Using different keywords</li>
        <li>Checking for typos</li>
        <li>Using shorter search terms</li>
      </ul>
    </div>
  </div>
);

/**
 * Initial state when no query entered
 */
const InitialState: React.FC = () => (
  <div className="py-12 text-center">
    <RiSearchLine className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
      Search your calls
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Search across transcripts, insights, and quotes
    </p>
    <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 dark:text-gray-500">
      <RiKeyboardBoxLine className="w-4 h-4" />
      <span>Type at least 2 characters to search</span>
    </div>
  </div>
);

/**
 * Query too short state
 */
const QueryTooShortState: React.FC = () => (
  <div className="py-8 text-center">
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Keep typing... (minimum 2 characters)
    </p>
  </div>
);

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  className,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Search store for modal state
  const { isModalOpen, openModal, closeModal } = useSearchStore();

  // Global search hook for querying
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clear,
    isQueryTooShort,
  } = useGlobalSearch({ enabled: isModalOpen });

  // Register global keyboard shortcut (Cmd/Ctrl+K)
  useSearchShortcut(() => {
    if (isModalOpen) {
      // If already open, focus the input
      inputRef.current?.focus();
    } else {
      openModal();
    }
  }, true);

  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  // Handle modal close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
      clear();
    }
  };

  // Handle result click - navigate to the call
  const handleResultClick = (result: SearchResult) => {
    // Navigate to the call detail page
    navigate(`/call/${result.sourceCallId}`);
    closeModal();
    clear();
  };

  // Handle keyboard navigation in input
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      // Navigate to the first result
      handleResultClick(results[0]);
    }
  };

  // Determine what to render in the results area
  const renderContent = () => {
    // Error state
    if (error) {
      return (
        <div className="py-8 text-center">
          <p className="text-sm text-red-500 dark:text-red-400">
            {error}
          </p>
        </div>
      );
    }

    // Loading state
    if (isLoading) {
      return (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <SearchResultSkeleton />
          <SearchResultSkeleton />
          <SearchResultSkeleton />
        </div>
      );
    }

    // No query entered
    if (!query.trim()) {
      return <InitialState />;
    }

    // Query too short
    if (isQueryTooShort) {
      return <QueryTooShortState />;
    }

    // Empty results
    if (results.length === 0) {
      return <EmptyState query={query} />;
    }

    // Results list
    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {results.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onClick={handleResultClick}
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-2xl p-0 gap-0 overflow-hidden',
          className
        )}
        aria-describedby="search-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription id="search-description">
            Search across transcripts, insights, and quotes
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <RiSearchLine className="w-5 h-5 text-gray-400 shrink-0" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search calls, insights, content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="border-0 p-0 h-auto text-base focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {/* Keyboard shortcut hint */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700">
              esc
            </kbd>
            <span className="text-xs text-gray-400">to close</span>
          </div>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {renderContent()}
        </div>

        {/* Footer with tips */}
        {results.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400">
            <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 font-medium bg-gray-100 dark:bg-gray-800 rounded">
                  Enter
                </kbd>
                <span>to select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 font-medium bg-gray-100 dark:bg-gray-800 rounded">
                  Tab
                </kbd>
                <span>to navigate</span>
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearchModal;
