/**
 * Centralized Error Capture System
 *
 * Ensures ALL errors are captured regardless of source:
 * - Global window errors (onerror)
 * - Unhandled promise rejections
 * - Console.error calls
 * - Network errors
 * - React errors (via ErrorBoundary)
 *
 * Also maintains an in-memory error log for debugging.
 */

import * as Sentry from '@sentry/react';

// Error source types for categorization
export type ErrorSource =
  | 'window.onerror'
  | 'unhandledrejection'
  | 'console.error'
  | 'network'
  | 'react-boundary'
  | 'manual'
  | 'unknown';

// Enhanced error entry with metadata
export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  source: ErrorSource;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  metadata?: Record<string, unknown>;
  sentToSentry: boolean;
}

// In-memory error log (circular buffer)
const MAX_ERROR_LOG_SIZE = 100;
const errorLog: ErrorLogEntry[] = [];
let errorIdCounter = 0;

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${++errorIdCounter}`;
}

// Add error to log
function addToErrorLog(entry: Omit<ErrorLogEntry, 'id'>): ErrorLogEntry {
  const fullEntry: ErrorLogEntry = {
    ...entry,
    id: generateErrorId(),
  };

  errorLog.push(fullEntry);

  // Keep log size bounded
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  // Emit custom event for UI listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('error-log-update', {
      detail: fullEntry
    }));
  }

  return fullEntry;
}

// Check if error should be ignored (browser extensions, etc.)
function shouldIgnoreError(message: string): boolean {
  const ignorePatterns = [
    /chrome-extension:\/\//,
    /moz-extension:\/\//,
    /ResizeObserver loop/,
    /Script error\./,
  ];
  return ignorePatterns.some(pattern => pattern.test(message));
}

// Send error to Sentry with enhanced context
function sendToSentry(
  error: Error | string,
  source: ErrorSource,
  extra?: Record<string, unknown>
): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  Sentry.withScope((scope) => {
    scope.setTag('error_source', source);
    scope.setLevel('error');

    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(errorObj);
  });
}

// Core capture function
export function captureError(
  error: Error | string,
  source: ErrorSource,
  options: {
    sendToSentry?: boolean;
    metadata?: Record<string, unknown>;
    componentStack?: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  } = {}
): ErrorLogEntry {
  const {
    sendToSentry: shouldSendToSentry = true,
    metadata,
    componentStack,
    url,
    lineNumber,
    columnNumber,
  } = options;

  const errorObj = typeof error === 'string' ? new Error(error) : error;
  const message = errorObj.message || String(error);

  // Check if should ignore
  if (shouldIgnoreError(message)) {
    return addToErrorLog({
      timestamp: new Date(),
      source,
      message: `[IGNORED] ${message}`,
      sentToSentry: false,
    });
  }

  // Log to console in development with enhanced formatting
  if (import.meta.env.DEV) {
    const sourceEmoji = {
      'window.onerror': '🌐',
      'unhandledrejection': '⚡',
      'console.error': '📝',
      'network': '🌍',
      'react-boundary': '⚛️',
      'manual': '✋',
      'unknown': '❓',
    }[source] || '❓';

    console.group(`${sourceEmoji} [${source}] Error Captured`);
    console.error('Message:', message);
    if (errorObj.stack) console.error('Stack:', errorObj.stack);
    if (componentStack) console.error('Component Stack:', componentStack);
    if (url) console.error('URL:', url, 'Line:', lineNumber, 'Col:', columnNumber);
    if (metadata) console.error('Metadata:', metadata);
    console.groupEnd();
  }

  // Send to Sentry
  let sentToSentry = false;
  if (shouldSendToSentry) {
    sendToSentry(errorObj, source, {
      ...metadata,
      componentStack,
      url,
      lineNumber,
      columnNumber,
    });
    sentToSentry = true;
  }

  // Add to log
  return addToErrorLog({
    timestamp: new Date(),
    source,
    message,
    stack: errorObj.stack,
    componentStack,
    url,
    lineNumber,
    columnNumber,
    metadata,
    sentToSentry,
  });
}

// Store original console.error
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Flag to prevent recursive capture
let isCapturing = false;

// Initialize global error handlers
export function initErrorCapture(): void {
  if (typeof window === 'undefined') return;

  // 1. Global window.onerror handler
  const originalOnError = window.onerror;
  window.onerror = function(
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean {
    captureError(
      error || String(message),
      'window.onerror',
      {
        url: source,
        lineNumber: lineno,
        columnNumber: colno,
      }
    );

    // Call original handler if exists
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  // 2. Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    captureError(error, 'unhandledrejection', {
      metadata: {
        reason: event.reason,
        type: typeof event.reason,
      },
    });
  });

  // 3. Intercept console.error
  console.error = function(...args: unknown[]): void {
    // Avoid recursive capture
    if (isCapturing) {
      originalConsoleError.apply(console, args);
      return;
    }

    isCapturing = true;

    try {
      // Call original first
      originalConsoleError.apply(console, args);

      // Extract error from arguments
      const firstArg = args[0];
      let error: Error | string;
      let metadata: Record<string, unknown> = {};

      if (firstArg instanceof Error) {
        error = firstArg;
        metadata.additionalArgs = args.slice(1);
      } else if (typeof firstArg === 'string') {
        // Check if this is from our own error capture (avoid double-logging)
        if (firstArg.includes('[ERROR]') || firstArg.includes('Error Captured')) {
          return;
        }
        error = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
      } else {
        error = String(args.join(' '));
      }

      // Don't re-capture Sentry's own logs
      if (String(error).includes('Sentry captured error')) {
        return;
      }

      captureError(error, 'console.error', {
        metadata,
        sendToSentry: true, // Ensure all console.error calls go to Sentry
      });
    } finally {
      isCapturing = false;
    }
  };

  // 4. Network error monitoring via fetch wrapper
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const response = await originalFetch.call(window, input, init);

      // Capture HTTP errors (4xx, 5xx) - but don't block
      if (!response.ok && response.status >= 400) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        // Only capture server errors (5xx), not client errors (4xx) which are often expected
        if (response.status >= 500) {
          captureError(
            `HTTP ${response.status}: ${response.statusText}`,
            'network',
            {
              metadata: {
                url,
                status: response.status,
                statusText: response.statusText,
                method: init?.method || 'GET',
              },
              sendToSentry: true,
            }
          );
        }
      }

      return response;
    } catch (error) {
      // Capture network failures (e.g., connection refused)
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      captureError(
        error instanceof Error ? error : new Error(String(error)),
        'network',
        {
          metadata: {
            url,
            method: init?.method || 'GET',
            errorType: 'fetch_failed',
          },
        }
      );

      throw error; // Re-throw to preserve original behavior
    }
  };

  // Log initialization
  if (import.meta.env.DEV) {
    console.log('🛡️ Error capture system initialized');
    console.log('   - Global error handler: ✅');
    console.log('   - Promise rejection handler: ✅');
    console.log('   - Console.error interceptor: ✅');
    console.log('   - Network error monitoring: ✅');
  }
}

// Get all captured errors
export function getErrorLog(): readonly ErrorLogEntry[] {
  return [...errorLog];
}

// Get recent errors
export function getRecentErrors(count: number = 10): readonly ErrorLogEntry[] {
  return errorLog.slice(-count);
}

// Clear error log
export function clearErrorLog(): void {
  errorLog.length = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('error-log-cleared'));
  }
}

// Get error statistics
export function getErrorStats(): {
  total: number;
  bySource: Record<ErrorSource, number>;
  sentToSentry: number;
  lastHour: number;
} {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const bySource: Record<ErrorSource, number> = {
    'window.onerror': 0,
    'unhandledrejection': 0,
    'console.error': 0,
    'network': 0,
    'react-boundary': 0,
    'manual': 0,
    'unknown': 0,
  };

  let sentToSentry = 0;
  let lastHour = 0;

  for (const entry of errorLog) {
    bySource[entry.source]++;
    if (entry.sentToSentry) sentToSentry++;
    if (entry.timestamp.getTime() > oneHourAgo) lastHour++;
  }

  return {
    total: errorLog.length,
    bySource,
    sentToSentry,
    lastHour,
  };
}

// Export original console methods for internal use
export { originalConsoleError, originalConsoleWarn };
