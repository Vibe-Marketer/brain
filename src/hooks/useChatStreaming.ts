/**
 * useChatStreaming - Streaming state management for chat
 * 
 * Extracts streaming-related state and utilities from Chat.tsx for testability.
 * Handles rate limiting, reconnection attempts, and error detection.
 */

import * as React from 'react';
import { logger } from '@/lib/logger';

// ==================== Constants ====================

export const ERROR_LOG_INTERVAL_MS = 5000; // Log at most once per 5 seconds per error type
export const MAX_RECONNECT_ATTEMPTS = 3;
export const BASE_RECONNECT_DELAY = 1000; // 1 second base delay

// ==================== Error Detection Helpers ====================

/**
 * Detect rate limit errors from error messages
 */
export function isRateLimitError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  );
}

/**
 * Detect streaming interruption errors (network/connection issues)
 */
export function isStreamingInterruptionError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorName = error instanceof Error ? error.name.toLowerCase() : '';

  return (
    // Abort errors (timeout or manual abort)
    errorName === 'aborterror' ||
    errorMessage.includes('aborted') ||
    // Network errors
    errorMessage.includes('network') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('socket') ||
    // Stream errors
    errorMessage.includes('stream') ||
    errorMessage.includes('readable') ||
    // Generic fetch failures
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('load failed')
  );
}

/**
 * Extract retry-after seconds from error (default to 30 seconds if not specified)
 */
export function extractRetryAfterSeconds(error: unknown): number {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Try to extract retry-after from various formats
  // e.g., "retry after 30 seconds", "retry-after: 30", "wait 30s"
  const patterns = [
    /retry[- ]?after[:\s]+(\d+)/i,
    /wait\s+(\d+)\s*s/i,
    /(\d+)\s*seconds?/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      const seconds = parseInt(match[1], 10);
      if (!isNaN(seconds) && seconds > 0 && seconds <= 300) { // Cap at 5 minutes
        return seconds;
      }
    }
  }

  // Default to 30 seconds if no retry-after specified
  return 30;
}

// ==================== Throttled Error Logging ====================

const lastErrorLogTime = { current: new Map<string, number>() };

/**
 * Throttle error logging to prevent console spam during network issues
 */
export function throttledErrorLog(errorType: string, message: string, ...args: unknown[]): void {
  const now = Date.now();
  const lastLog = lastErrorLogTime.current.get(errorType) || 0;

  if (now - lastLog >= ERROR_LOG_INTERVAL_MS) {
    lastErrorLogTime.current.set(errorType, now);
    logger.error(message, ...args);
  }
}

// ==================== Hook Interface ====================

interface UseChatStreamingOptions {
  onRateLimitStart?: (seconds: number) => void;
  onRateLimitEnd?: () => void;
  onReconnectStart?: () => void;
  onReconnectEnd?: (success: boolean) => void;
}

interface UseChatStreamingReturn {
  // Rate limit state
  isRateLimited: boolean;
  rateLimitCooldownEnd: number | null;
  rateLimitSeconds: number;
  setRateLimitCooldown: (endTime: number, seconds: number) => void;
  clearRateLimitCooldown: () => void;
  
  // Reconnection state (refs for avoiding infinite loops)
  reconnectAttemptsRef: React.MutableRefObject<number>;
  reconnectAttemptDisplay: number;
  setReconnectAttemptDisplay: React.Dispatch<React.SetStateAction<number>>;
  isReconnecting: boolean;
  setIsReconnecting: React.Dispatch<React.SetStateAction<boolean>>;
  lastUserMessageRef: React.MutableRefObject<string | null>;
  reconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  handledErrorRef: React.MutableRefObject<Error | null>;
  
  // Incomplete message tracking
  incompleteMessageIds: Set<string>;
  setIncompleteMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  
  // Constants
  MAX_RECONNECT_ATTEMPTS: number;
  BASE_RECONNECT_DELAY: number;
  
  // Helpers
  resetReconnectionState: () => void;
}

/**
 * Hook for managing chat streaming state
 * 
 * Extracts all streaming-related state from Chat.tsx including:
 * - Rate limit detection and cooldown
 * - Reconnection attempts tracking
 * - Incomplete message tracking
 * - Error throttling utilities
 */
export function useChatStreaming(options: UseChatStreamingOptions = {}): UseChatStreamingReturn {
  const { onRateLimitEnd } = options;

  // Rate limit cooldown state
  const [rateLimitCooldownEnd, setRateLimitCooldownEnd] = React.useState<number | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = React.useState<number>(0);
  const rateLimitToastIdRef = React.useRef<string | number | null>(null);

  // Streaming reconnection state
  // CRITICAL: Use refs for reconnect attempts to avoid infinite loop in error effect
  // Using state causes effect to re-fire when attempts change, creating runaway loop
  const reconnectAttemptsRef = React.useRef(0);
  // Display-only state for UI (NOT used in error effect deps)
  const [reconnectAttemptDisplay, setReconnectAttemptDisplay] = React.useState(0);
  const [isReconnecting, setIsReconnecting] = React.useState(false);
  const lastUserMessageRef = React.useRef<string | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Track error we're currently handling to prevent re-processing same error
  const handledErrorRef = React.useRef<Error | null>(null);

  // Track incomplete assistant messages (streaming failed mid-response)
  const [incompleteMessageIds, setIncompleteMessageIds] = React.useState<Set<string>>(new Set());

  // Check if rate limited (cooldown is active)
  const isRateLimited = rateLimitCooldownEnd !== null && Date.now() < rateLimitCooldownEnd;

  // Set rate limit cooldown
  const setRateLimitCooldown = React.useCallback((endTime: number, seconds: number) => {
    setRateLimitCooldownEnd(endTime);
    setRateLimitSeconds(seconds);
  }, []);

  // Clear rate limit cooldown
  const clearRateLimitCooldown = React.useCallback(() => {
    setRateLimitCooldownEnd(null);
    setRateLimitSeconds(0);
    if (rateLimitToastIdRef.current) {
      rateLimitToastIdRef.current = null;
    }
    onRateLimitEnd?.();
  }, [onRateLimitEnd]);

  // Reset reconnection state
  const resetReconnectionState = React.useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setReconnectAttemptDisplay(0);
    setIsReconnecting(false);
    setIncompleteMessageIds(new Set());
    lastUserMessageRef.current = null;
    handledErrorRef.current = null;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Cleanup reconnect timeout on unmount
  React.useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Rate limit state
    isRateLimited,
    rateLimitCooldownEnd,
    rateLimitSeconds,
    setRateLimitCooldown,
    clearRateLimitCooldown,
    
    // Reconnection state
    reconnectAttemptsRef,
    reconnectAttemptDisplay,
    setReconnectAttemptDisplay,
    isReconnecting,
    setIsReconnecting,
    lastUserMessageRef,
    reconnectTimeoutRef,
    handledErrorRef,
    
    // Incomplete message tracking
    incompleteMessageIds,
    setIncompleteMessageIds,
    
    // Constants
    MAX_RECONNECT_ATTEMPTS,
    BASE_RECONNECT_DELAY,
    
    // Helpers
    resetReconnectionState,
  };
}
