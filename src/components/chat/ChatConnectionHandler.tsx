/**
 * ChatConnectionHandler - Connection status display and retry logic
 * 
 * Displays connection state information including:
 * - Reconnection status
 * - Rate limit warnings
 * - Session invalid warnings
 * - Error states with retry buttons
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RiWifiOffLine, RiRefreshLine, RiTimeLine, RiAlertLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'rate-limited';

// ==================== Props Interface ====================

export interface ChatConnectionHandlerProps {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether rate limited */
  isRateLimited: boolean;
  /** Seconds remaining in rate limit */
  rateLimitSeconds: number;
  /** Whether reconnecting */
  isReconnecting: boolean;
  /** Current reconnect attempt */
  reconnectAttempt: number;
  /** Max reconnect attempts */
  maxReconnectAttempts: number;
  /** Error message if any */
  error?: string;
  /** Callback for retry action */
  onRetry: () => void;
  /** Callback for dismiss action */
  onDismiss?: () => void;
  /** Additional className */
  className?: string;
}

// ==================== Component ====================

/**
 * ChatConnectionHandler component
 * 
 * Renders connection status banners/alerts for various states:
 * - Reconnecting: Shows attempt progress
 * - Rate limited: Shows countdown
 * - Disconnected: Shows error with retry button
 * - Connected: Shows nothing (normal state)
 */
export function ChatConnectionHandler({
  connectionState,
  isRateLimited,
  rateLimitSeconds,
  isReconnecting,
  reconnectAttempt,
  maxReconnectAttempts,
  error,
  onRetry,
  onDismiss,
  className,
}: ChatConnectionHandlerProps): React.ReactElement | null {
  // Don't show anything when connected
  if (connectionState === 'connected' && !error) {
    return null;
  }

  return (
    <div className={cn('px-4 py-2', className)}>
      {/* Rate Limited State */}
      {isRateLimited && (
        <RateLimitBanner seconds={rateLimitSeconds} />
      )}

      {/* Reconnecting State */}
      {isReconnecting && !isRateLimited && (
        <ReconnectingBanner
          attempt={reconnectAttempt}
          maxAttempts={maxReconnectAttempts}
        />
      )}

      {/* Disconnected/Error State */}
      {connectionState === 'disconnected' && !isReconnecting && !isRateLimited && (
        <DisconnectedBanner
          error={error}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}

// ==================== Sub-components ====================

interface RateLimitBannerProps {
  seconds: number;
}

function RateLimitBanner({ seconds }: RateLimitBannerProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 p-3">
      <div className="flex-shrink-0">
        <RiTimeLine className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Rate limit exceeded
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          Please wait {seconds} second{seconds !== 1 ? 's' : ''} before sending another message.
        </p>
      </div>
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full border-2 border-amber-300 dark:border-amber-600 flex items-center justify-center">
          <span className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300">
            {seconds}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ReconnectingBannerProps {
  attempt: number;
  maxAttempts: number;
}

function ReconnectingBanner({ attempt, maxAttempts }: ReconnectingBannerProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800/50 p-3">
      <div className="flex-shrink-0">
        <RiRefreshLine className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
          Reconnecting...
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
          Attempt {attempt} of {maxAttempts}
        </p>
      </div>
      <div className="flex-shrink-0">
        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i < attempt
                  ? 'bg-blue-500 dark:bg-blue-400'
                  : 'bg-blue-200 dark:bg-blue-700'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DisconnectedBannerProps {
  error?: string;
  onRetry: () => void;
  onDismiss?: () => void;
}

function DisconnectedBanner({ error, onRetry, onDismiss }: DisconnectedBannerProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/50 p-3">
      <div className="flex-shrink-0">
        <RiWifiOffLine className="h-5 w-5 text-red-600 dark:text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          Connection lost
        </p>
        {error && (
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5 truncate">
            {error}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <RiRefreshLine className="h-3.5 w-3.5" />
          Retry
        </Button>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}

// ==================== Inline Warning (for input area) ====================

export interface ConnectionWarningInlineProps {
  /** Whether chat is ready */
  isChatReady: boolean;
  /** Whether loading */
  isLoading: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Inline connection warning shown in the message area
 * when session is not ready
 */
export function ConnectionWarningInline({
  isChatReady,
  isLoading,
  className,
}: ConnectionWarningInlineProps): React.ReactElement | null {
  // Only show if NOT loading and NOT ready
  if (isChatReady || isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-yellow-700 dark:text-yellow-400',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <RiAlertLine className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Session not ready</p>
          <p className="text-xs mt-1">Please sign in to use chat features.</p>
        </div>
      </div>
    </div>
  );
}
