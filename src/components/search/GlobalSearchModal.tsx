import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiSearchLine, RiCloseLine, RiLoader4Line } from '@remixicon/react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useSearchStore } from '@/stores/searchStore';
import { useSearchShortcut } from '@/hooks/useKeyboardShortcut';
import { getSourceLabel } from '@/lib/source-labels';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { SearchResult } from '@/types/search';

/**
 * GlobalSearchModal - Full-screen search modal triggered by Cmd+K
 *
 * Searches across call titles, transcripts, and summaries within the
 * current organization. Results navigate to the call detail modal.
 *
 * @pattern search-modal
 */
export function GlobalSearchModal() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { isModalOpen, openModal, closeModal } = useSearchStore();
  const { query, setQuery, results, isLoading, error, clear, isQueryTooShort } = useGlobalSearch({
    enabled: isModalOpen,
  });

  // Register Cmd+K to open the modal
  useSearchShortcut(openModal);

  // Auto-focus the input when the modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Small delay to let the dialog animation start before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      clear();
    }
  }, [isModalOpen, clear]);

  const handleResultClick = (result: SearchResult) => {
    navigate(`/?callId=${result.sourceCallId}`);
    closeModal();
  };

  const handleClearInput = () => {
    clear();
    inputRef.current?.focus();
  };

  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'MMM d, yyyy');
    } catch {
      return '';
    }
  };

  const getPlatformDot = (platform: string | null | undefined) => {
    const colors: Record<string, string> = {
      fathom: 'bg-blue-400',
      zoom: 'bg-blue-600',
      youtube: 'bg-red-500',
      'file-upload': 'bg-muted-foreground',
    };
    return platform ? colors[platform] || 'bg-muted-foreground' : null;
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
      <DialogContent
        className="p-0 gap-0 max-w-2xl w-full overflow-hidden rounded-2xl border border-border"
      >
        {/* Visually hidden title + description for screen readers (Phase 36-05 BUG-09) */}
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across calls, transcripts, summaries, contacts, and folders.
        </DialogDescription>

        {/* Search Input Row */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-3 px-3 h-10 rounded-md border border-border bg-muted/30 focus-within:bg-card focus-within:border-vibe-orange/40 focus-within:ring-2 focus-within:ring-vibe-orange/20 transition">
            <RiSearchLine className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calls, transcripts, and summaries..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={handleClearInput}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <RiLoader4Line className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          )}

          {/* Empty state — no query */}
          {!isLoading && !query && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Search calls, transcripts, and summaries
            </div>
          )}

          {/* Query too short */}
          {!isLoading && isQueryTooShort && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex items-center justify-center py-12 text-sm text-destructive">
              Search failed. Please try again.
            </div>
          )}

          {/* No results */}
          {!isLoading && !error && !isQueryTooShort && query && results.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Results list */}
          {!isLoading && results.length > 0 && (
            <ul role="listbox" aria-label="Search results">
              {results.map((result) => {
                const dotColor = getPlatformDot(result.sourcePlatform);
                const ts = formatTimestamp(result.timestamp);

                return (
                  <li
                    key={result.id}
                    role="option"
                    aria-selected={false}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer',
                      'hover:bg-muted/50 transition-colors',
                      'border-b border-border last:border-b-0'
                    )}
                  >
                    {/* Platform dot */}
                    <div className="flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                      {dotColor ? (
                        <span
                          className={cn('w-2 h-2 rounded-full shrink-0', dotColor)}
                          title={getSourceLabel(result.sourcePlatform)}
                        />
                      ) : (
                        <RiSearchLine className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 justify-between">
                        <p className="text-sm font-medium text-foreground truncate">
                          {result.title}
                        </p>
                        {ts && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {ts}
                          </span>
                        )}
                      </div>
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {result.snippet}
                        </p>
                      )}
                      {result.sourcePlatform && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {getSourceLabel(result.sourcePlatform)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Hint bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">
            <kbd className="font-mono">Esc</kbd> to close
          </span>
          <span className="text-xs text-muted-foreground">
            <kbd className="font-mono">Enter</kbd> to open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
