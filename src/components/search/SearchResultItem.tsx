/**
 * SearchResultItem Component
 *
 * Displays a single search result with:
 * - Type indicator (transcript/insight/quote)
 * - Title and snippet
 * - Source information
 * - Click to navigate functionality
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiFileTextLine,
  RiLightbulbLine,
  RiDoubleQuotesL,
  RiEmotionUnhappyLine,
  RiTrophyLine,
  RiAlertLine,
  RiQuestionLine,
} from '@remixicon/react';
import { FathomIcon, GoogleMeetIcon } from '@/components/transcript-library/SourcePlatformIcons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SearchResult, SearchInsightType, SourcePlatform } from '@/types/search';

export interface SearchResultItemProps {
  /** The search result data */
  result: SearchResult;
  /** Callback when the result is clicked */
  onClick?: (result: SearchResult) => void;
  /** Whether the item is currently highlighted (keyboard navigation) */
  isHighlighted?: boolean;
}

/**
 * Configuration for result type styling
 */
const RESULT_TYPE_CONFIG = {
  transcript: {
    icon: RiFileTextLine,
    label: 'Transcript',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  insight: {
    icon: RiLightbulbLine,
    label: 'Insight',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  quote: {
    icon: RiDoubleQuotesL,
    label: 'Quote',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
};

/**
 * Configuration for source platform badges
 */
const SOURCE_PLATFORM_CONFIG: Record<
  SourcePlatform,
  {
    Icon: typeof FathomIcon;
    label: string;
  }
> = {
  fathom: {
    Icon: FathomIcon,
    label: 'Fathom',
  },
  google_meet: {
    Icon: GoogleMeetIcon,
    label: 'GMeet',
  },
};

/**
 * Configuration for insight subtypes (matches InsightCard)
 */
const INSIGHT_TYPE_CONFIG: Record<
  SearchInsightType,
  {
    icon: typeof RiEmotionUnhappyLine;
    label: string;
    color: string;
    bgColor: string;
    badgeClass: string;
  }
> = {
  pain: {
    icon: RiEmotionUnhappyLine,
    label: 'Pain Point',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  success: {
    icon: RiTrophyLine,
    label: 'Success',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  objection: {
    icon: RiAlertLine,
    label: 'Objection',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  question: {
    icon: RiQuestionLine,
    label: 'Question',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
};

/**
 * Format a timestamp string to a relative or absolute date
 */
const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString();
};

/**
 * Get the configuration for a search result based on its type
 */
const getResultConfig = (result: SearchResult) => {
  // For insights with a specific insight type, use that config
  if (result.type === 'insight' && result.metadata?.insightType) {
    return INSIGHT_TYPE_CONFIG[result.metadata.insightType];
  }

  // Otherwise use the general result type config
  return RESULT_TYPE_CONFIG[result.type];
};

/**
 * Generate the navigation route for a search result
 * All result types navigate to the call detail page
 *
 * @param result - The search result to generate a route for
 * @returns The navigation path
 */
export const getResultRoute = (result: SearchResult): string => {
  // Base route is always the call detail page
  const basePath = `/call/${result.sourceCallId}`;

  // For transcript results, we could add a segment/timestamp hash
  // For now, all types navigate to the call detail page
  switch (result.type) {
    case 'transcript':
      // Navigate to call, potentially with timestamp in the future
      return basePath;
    case 'insight':
      // Navigate to call where the insight was extracted
      // Future enhancement: scroll to or highlight the insight
      return basePath;
    case 'quote':
      // Navigate to call containing the quote
      return basePath;
    default:
      return basePath;
  }
};

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onClick,
  isHighlighted = false,
}) => {
  const navigate = useNavigate();
  const config = getResultConfig(result);
  const Icon = config.icon;

  /**
   * Handle click/selection of a search result
   * Navigates to the appropriate route and calls onClick callback
   */
  const handleClick = () => {
    // Navigate to the result's page
    const route = getResultRoute(result);
    navigate(route);

    // Call the onClick callback (used by GlobalSearchModal to close modal)
    onClick?.(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
        'border border-transparent',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
        isHighlighted && 'bg-gray-50 dark:bg-gray-800/50 border-purple-200 dark:border-purple-800'
      )}
      aria-label={`${config.label}: ${result.title}`}
    >
      {/* Icon */}
      <div className={cn('p-2 rounded-lg shrink-0', config.bgColor)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title Row */}
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {result.title}
          </h4>
          <Badge
            className={cn(
              'shrink-0 text-[10px] px-1.5 py-0 border-0',
              config.badgeClass
            )}
          >
            {config.label}
          </Badge>
          {/* Source Platform Badge */}
          {result.sourcePlatform && SOURCE_PLATFORM_CONFIG[result.sourcePlatform] && (
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] px-1.5 py-0 flex items-center gap-0.5"
            >
              {React.createElement(SOURCE_PLATFORM_CONFIG[result.sourcePlatform].Icon, {
                className: 'h-2.5 w-2.5',
              })}
              {SOURCE_PLATFORM_CONFIG[result.sourcePlatform].label}
            </Badge>
          )}
          {/* Relevance Score Badge */}
          {result.metadata?.confidence !== undefined && (
            <span className="shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {result.metadata.confidence}%
            </span>
          )}
        </div>

        {/* Snippet */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-1.5">
          {result.snippet}
        </p>

        {/* Metadata Row */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
          <span className="truncate">{result.sourceCallTitle}</span>
          {result.timestamp && (
            <>
              <span className="shrink-0">·</span>
              <span className="shrink-0">{formatTimestamp(result.timestamp)}</span>
            </>
          )}
          {result.metadata?.speakerName && (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate">{result.metadata.speakerName}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultItem;
