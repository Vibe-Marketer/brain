/**
 * Debug Panel Context
 *
 * Global state management for debug messages.
 * Provides addMessage() for logging from anywhere in the app.
 * Integrates with Sentry for production error tracking.
 *
 * Features:
 * - localStorage persistence (survives refresh)
 * - 4xx/5xx HTTP error tracking
 * - WebSocket event logging
 * - Rapid state change detection
 * - Error acknowledgment system
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { DebugMessage, ActionTrailEntry, DebugPanelConfig, ResolvedErrorRecord, AppStateSnapshot, ResolutionStatus, IgnoredPattern } from './types';
import { STORAGE_KEYS } from './types';

// Sentry is OPTIONAL - only used if already installed in the host app
// This allows the Debug Panel to work as a standalone "Sentry replacement"
let Sentry: typeof import('@sentry/react') | null = null;
try {
  // Dynamic import check - only loads if @sentry/react is installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/react');
} catch {
  // Sentry not installed - that's fine, we'll skip Sentry integration
  Sentry = null;
}

// Default configuration
const DEFAULT_CONFIG: Required<DebugPanelConfig> = {
  maxMessages: 500,
  maxActions: 50,
  persistMessages: true,
  persistedMessageLimit: 100,
  trackHttpErrors: true,
  track4xxAsWarnings: true,
  enableSentry: true,
  rapidStateThreshold: 20,
  rapidStateWindow: 500,
  // Performance tracking defaults
  trackSlowRequests: true,
  slowRequestThreshold: 3000,      // 3 seconds
  trackLargePayloads: true,
  largePayloadThreshold: 1048576,  // 1 MB
  trackLongTasks: false,           // Disabled - too noisy, focus on actual errors
  longTaskThreshold: 1000,         // 1 second (only if re-enabled)
  trackResourceErrors: true,
};

// Patterns to ignore (browser extensions, etc.)
const IGNORE_PATTERNS = [
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
  /ResizeObserver loop/,
  /Script error\./,
];

function shouldIgnore(message: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Extract meaningful error messages from various object shapes
 */
function extractErrorMessage(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }
  if (typeof arg === 'string') {
    return arg;
  }
  if (typeof arg === 'object' && arg !== null) {
    const obj = arg as Record<string, unknown>;
    // Try common error properties in priority order
    if (obj.message && typeof obj.message === 'string') return obj.message;
    if (obj.error && typeof obj.error === 'string') return obj.error;
    if (obj.errorMessage && typeof obj.errorMessage === 'string') return obj.errorMessage;
    if (obj.msg && typeof obj.msg === 'string') return obj.msg;
    if (obj.reason && typeof obj.reason === 'string') return obj.reason;
    if (obj.code) return `Error code: ${String(obj.code)}`;
    if (obj.statusText && typeof obj.statusText === 'string') return obj.statusText;

    // Try to stringify, but handle empty objects specially
    try {
      const str = JSON.stringify(arg, null, 2);
      if (str === '{}') return '[Empty Error Object - check stack trace]';
      if (str === '[]') return '[Empty Array]';
      return str;
    } catch {
      return '[Unserializable Object]';
    }
  }
  return String(arg);
}

/**
 * Load persisted messages from localStorage
 */
function loadPersistedMessages(): DebugMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Load persisted action trail from localStorage
 */
function loadPersistedActions(): ActionTrailEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTION_TRAIL);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Save messages to localStorage
 */
function persistMessages(messages: DebugMessage[], limit: number): void {
  try {
    const toSave = messages.slice(-limit);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Save action trail to localStorage
 */
function persistActions(actions: ActionTrailEntry[], limit: number): void {
  try {
    const toSave = actions.slice(-limit);
    localStorage.setItem(STORAGE_KEYS.ACTION_TRAIL, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generate a unique signature for an error to identify "same" errors
 * Used for recurrence detection after resolution
 */
function generateErrorSignature(message: string, source?: string, category?: string): string {
  // Normalize the message: remove numbers, timestamps, IDs to group similar errors
  const normalizedMessage = message
    .replace(/\d+/g, 'N')                    // Replace numbers with N
    .replace(/[a-f0-9]{8,}/gi, 'ID')         // Replace hex IDs with ID
    .replace(/\s+/g, ' ')                     // Normalize whitespace
    .trim()
    .toLowerCase();

  // Create a simple hash from the normalized components
  const components = [normalizedMessage, source || '', category || ''].join('|');
  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

/**
 * Load resolved errors from localStorage
 */
function loadResolvedErrors(): Map<string, ResolvedErrorRecord> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RESOLVED_ERRORS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Map(parsed.map((r: ResolvedErrorRecord) => [r.signature, r]));
      }
    }
  } catch {
    // Ignore parse errors
  }
  return new Map();
}

/**
 * Save resolved errors to localStorage
 */
function persistResolvedErrors(resolved: Map<string, ResolvedErrorRecord>): void {
  try {
    const toSave = Array.from(resolved.values());
    localStorage.setItem(STORAGE_KEYS.RESOLVED_ERRORS, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load ignored patterns from localStorage
 */
function loadIgnoredPatterns(): Map<string, IgnoredPattern> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.IGNORED_PATTERNS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Map(parsed.map((p: IgnoredPattern) => [p.signature, p]));
      }
    }
  } catch {
    // Ignore parse errors
  }
  return new Map();
}

/**
 * Save ignored patterns to localStorage
 */
function persistIgnoredPatterns(patterns: Map<string, IgnoredPattern>): void {
  try {
    const toSave = Array.from(patterns.values());
    localStorage.setItem(STORAGE_KEYS.IGNORED_PATTERNS, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Capture current app state for comparison
 */
function captureAppState(actionTrail: ActionTrailEntry[]): AppStateSnapshot {
  return {
    url: window.location.href,
    timestamp: Date.now(),
    recentActions: actionTrail.slice(-5).map(a => `${a.action}: ${a.description}`),
    activeComponent: window.location.pathname,
  };
}

interface DebugPanelContextType {
  messages: DebugMessage[];
  actionTrail: ActionTrailEntry[];
  unacknowledgedCount: number;
  resolvedErrors: Map<string, ResolvedErrorRecord>;
  ignoredPatterns: Map<string, IgnoredPattern>;
  addMessage: (msg: Omit<DebugMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  logAction: (action: ActionTrailEntry['action'], description: string, details?: string) => void;
  logWebSocket: (messageType: string, data: unknown, wsCategory?: DebugMessage['wsCategory']) => void;
  clearMessages: (clearResolved?: boolean) => void;
  clearStaleMessages: (staleThresholdMs?: number) => void;
  toggleBookmark: (messageId: string) => void;
  acknowledgeErrors: () => void;
  acknowledgeMessage: (messageId: string) => void;
  // Resolution tracking
  resolveError: (messageId: string, note?: string) => void;
  unresolveError: (messageId: string) => void;
  getResolutionHistory: (signature: string) => ResolvedErrorRecord | undefined;
  // Ignore patterns
  ignoreMessage: (messageId: string, reason?: string) => void;
  addIgnorePattern: (message: string, source?: string, category?: string, reason?: string) => void;
  unignorePattern: (signature: string) => void;
  isMessageIgnored: (message: DebugMessage) => boolean;
}

const DebugPanelContext = createContext<DebugPanelContextType | undefined>(undefined);

let messageCounter = 0;

function generateId(): string {
  messageCounter = (messageCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${messageCounter}`;
}

// Flag to prevent recursive capture
let isCapturing = false;

// Generate or retrieve session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  }
  return sessionId;
}

interface DebugPanelProviderProps {
  children: React.ReactNode;
  config?: Partial<DebugPanelConfig>;
}

export function DebugPanelProvider({ children, config: userConfig }: DebugPanelProviderProps) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // Initialize with persisted data
  const [messages, setMessages] = useState<DebugMessage[]>(() =>
    config.persistMessages ? loadPersistedMessages() : []
  );
  const [actionTrail, setActionTrail] = useState<ActionTrailEntry[]>(() =>
    config.persistMessages ? loadPersistedActions() : []
  );
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [resolvedErrors, setResolvedErrors] = useState<Map<string, ResolvedErrorRecord>>(() =>
    config.persistMessages ? loadResolvedErrors() : new Map()
  );
  const [ignoredPatterns, setIgnoredPatterns] = useState<Map<string, IgnoredPattern>>(() =>
    config.persistMessages ? loadIgnoredPatterns() : new Map()
  );

  const isInitialized = useRef(false);
  const addMessageRef = useRef<typeof addMessageInternal | null>(null);
  const logActionRef = useRef<typeof logActionInternal | null>(null);
  const sessionId = useRef(getSessionId());

  // Persist messages whenever they change
  useEffect(() => {
    if (config.persistMessages) {
      persistMessages(messages, config.persistedMessageLimit);
    }
  }, [messages, config.persistMessages, config.persistedMessageLimit]);

  // Persist action trail whenever it changes
  useEffect(() => {
    if (config.persistMessages) {
      persistActions(actionTrail, config.maxActions);
    }
  }, [actionTrail, config.persistMessages, config.maxActions]);

  // Persist resolved errors whenever they change
  useEffect(() => {
    if (config.persistMessages) {
      persistResolvedErrors(resolvedErrors);
    }
  }, [resolvedErrors, config.persistMessages]);

  // Persist ignored patterns whenever they change
  useEffect(() => {
    if (config.persistMessages) {
      persistIgnoredPatterns(ignoredPatterns);
    }
  }, [ignoredPatterns, config.persistMessages]);

  // Update unacknowledged count
  useEffect(() => {
    const unackCount = messages.filter(
      m => m.type === 'error' && !m.isAcknowledged
    ).length;
    setUnacknowledgedCount(unackCount);
  }, [messages]);

  // Log user actions for trail
  const logActionInternal = useCallback((
    action: ActionTrailEntry['action'],
    description: string,
    details?: string
  ) => {
    const entry: ActionTrailEntry = {
      timestamp: Date.now(),
      action,
      description,
      details,
    };

    setActionTrail(prev => {
      const updated = [...prev, entry];
      if (updated.length > config.maxActions) {
        return updated.slice(-config.maxActions);
      }
      return updated;
    });
  }, [config.maxActions]);

  // Store ref for use in event handlers
  logActionRef.current = logActionInternal;

  // Internal add function
  const addMessageInternal = useCallback((
    msg: Omit<DebugMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
    sendToSentry = true
  ) => {
    // Ignore certain messages
    if (shouldIgnore(msg.message)) return;

    // Generate error signature for errors/warnings (for deduplication and recurrence detection)
    const isErrorOrWarning = msg.type === 'error' || msg.type === 'warning';
    const signature = isErrorOrWarning ? generateErrorSignature(msg.message, msg.source, msg.category) : undefined;

    // Check for recurrence of resolved errors
    let resolutionStatus: ResolutionStatus = 'active';
    let recurrenceCount = 0;
    let originalErrorId: string | undefined;

    if (msg.type === 'error' && signature && resolvedErrors.has(signature)) {
      const resolved = resolvedErrors.get(signature)!;
      resolutionStatus = 'recurring';
      recurrenceCount = resolved.recurrenceCount + 1;
      originalErrorId = resolved.signature;

      // Update the resolved error record with new recurrence
      setResolvedErrors(prev => {
        const updated = new Map(prev);
        updated.set(signature, {
          ...resolved,
          recurrenceCount,
          lastRecurrence: Date.now(),
        });
        return updated;
      });
    }

    const now = Date.now();

    // Check for existing message with same signature (deduplication)
    setMessages(prev => {
      if (signature) {
        const existingIndex = prev.findIndex(m => m.errorSignature === signature);
        if (existingIndex !== -1) {
          // Update existing message: bump lastSeen and count
          const existing = prev[existingIndex];
          const updated = [...prev];
          updated[existingIndex] = {
            ...existing,
            lastSeen: now,
            count: (existing.count || 1) + 1,
            // Update resolution status if this was a recurring error
            resolutionStatus: msg.type === 'error' ? resolutionStatus : existing.resolutionStatus,
            recurrenceCount: recurrenceCount > 0 ? recurrenceCount : existing.recurrenceCount,
            // Don't mark as acknowledged if it's recurring (user should see it)
            isAcknowledged: resolutionStatus === 'recurring' ? false : existing.isAcknowledged,
          };
          return updated;
        }
      }

      // New message - create it
      const newMessage: DebugMessage = {
        ...msg,
        id: msg.id || generateId(),
        timestamp: msg.timestamp || now,
        lastSeen: now,
        count: 1,
        isBookmarked: false,
        isAcknowledged: false,
        // Resolution tracking
        errorSignature: signature,
        resolutionStatus: msg.type === 'error' ? resolutionStatus : undefined,
        recurrenceCount: recurrenceCount > 0 ? recurrenceCount : undefined,
        originalErrorId,
        appStateSnapshot: msg.type === 'error' ? captureAppState(actionTrail) : undefined,
      };

      // Send errors to Sentry (only if Sentry is installed AND enabled)
      // Only send for NEW errors (first occurrence), not updates
      if (Sentry && config.enableSentry && sendToSentry && msg.type === 'error') {
        Sentry.withScope((scope) => {
          scope.setTag('source', msg.source || 'unknown');
          scope.setTag('category', msg.category || 'system');
          scope.setTag('session_id', sessionId.current);
          if (msg.stack) {
            scope.setExtra('stack', msg.stack);
          }
          if (msg.httpStatus) {
            scope.setTag('http_status', String(msg.httpStatus));
          }
          Sentry.captureMessage(msg.message, 'error');
        });
        newMessage.sentToSentry = true;
      }

      const updated = [...prev, newMessage];
      if (updated.length > config.maxMessages) {
        return updated.slice(-config.maxMessages);
      }
      return updated;
    });
  }, [config.enableSentry, config.maxMessages, resolvedErrors, actionTrail]);

  // Store ref for use in event handlers
  addMessageRef.current = addMessageInternal;

  // Set up global error handlers on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Store original console methods
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalFetch = window.fetch;

    // Capture unhandled errors
    const handleError = (event: ErrorEvent) => {
      if (isCapturing) return;
      addMessageRef.current?.({
        type: 'error',
        message: event.message || 'Unknown error',
        source: 'window.onerror',
        details: event.error?.stack,
        stack: event.error?.stack,
        category: 'system',
      });
    };

    // Capture unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isCapturing) return;
      const reason = event.reason;
      const message = extractErrorMessage(reason);
      addMessageRef.current?.({
        type: 'error',
        message: `Unhandled Promise Rejection: ${message}`,
        source: 'unhandledrejection',
        details: reason instanceof Error ? reason.stack : undefined,
        stack: reason instanceof Error ? reason.stack : undefined,
        category: 'system',
      });
    };

    // Intercept console.error
    console.error = (...args: unknown[]) => {
      originalConsoleError.apply(console, args);

      if (isCapturing) return;
      isCapturing = true;

      try {
        const message = args.map(extractErrorMessage).join(' ');

        // Skip only debug panel's own internal logs (not app logs)
        if (message.includes('Debug Panel initialized') || message.includes('Debug Panel Error')) {
          return;
        }

        addMessageRef.current?.({
          type: 'error',
          message,
          source: 'console.error',
          category: 'system',
        });
      } finally {
        isCapturing = false;
      }
    };

    // Intercept console.warn
    console.warn = (...args: unknown[]) => {
      originalConsoleWarn.apply(console, args);

      if (isCapturing) return;
      isCapturing = true;

      try {
        const message = args.map(extractErrorMessage).join(' ');

        addMessageRef.current?.({
          type: 'warning',
          message,
          source: 'console.warn',
          category: 'system',
        }, false); // Don't send warnings to Sentry
      } finally {
        isCapturing = false;
      }
    };

    // Intercept fetch for network errors, performance tracking, AND action trail
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const method = init?.method || 'GET';
      const startTime = performance.now();

      // Extract short URL for action trail (remove query params for readability)
      const shortUrl = (() => {
        try {
          const urlObj = new URL(url);
          return urlObj.pathname.slice(0, 50) + (urlObj.pathname.length > 50 ? '...' : '');
        } catch {
          return url.slice(0, 50);
        }
      })();

      // Log API call to action trail
      logActionRef.current?.('api_call', `${method} ${shortUrl}`, url);

      try {
        const response = await originalFetch.call(window, input, init);
        const duration = Math.round(performance.now() - startTime);

        // Track slow requests
        if (config.trackSlowRequests && duration > config.slowRequestThreshold) {
          addMessageRef.current?.({
            type: 'warning',
            message: `[SLOW REQUEST] ${method} ${shortUrl} took ${duration}ms`,
            source: 'performance',
            category: 'network',
            details: `URL: ${url}\nMethod: ${method}\nDuration: ${duration}ms\nThreshold: ${config.slowRequestThreshold}ms`,
            httpMethod: method,
            url,
            duration,
          }, false); // Don't send to Sentry
        }

        // Track large payloads (check Content-Length header)
        if (config.trackLargePayloads) {
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            const size = parseInt(contentLength, 10);
            if (size > config.largePayloadThreshold) {
              const sizeMB = (size / 1048576).toFixed(2);
              addMessageRef.current?.({
                type: 'warning',
                message: `[LARGE PAYLOAD] ${method} ${shortUrl} returned ${sizeMB}MB`,
                source: 'performance',
                category: 'network',
                details: `URL: ${url}\nMethod: ${method}\nSize: ${sizeMB}MB (${size} bytes)\nThreshold: ${(config.largePayloadThreshold / 1048576).toFixed(2)}MB`,
                httpMethod: method,
                url,
              }, false); // Don't send to Sentry
            }
          }
        }

        // Capture HTTP errors (4xx and 5xx)
        if (config.trackHttpErrors && response.status >= 400) {
          const isServerError = response.status >= 500;
          const type = isServerError ? 'error' : (config.track4xxAsWarnings ? 'warning' : 'error');

          addMessageRef.current?.({
            type,
            message: `HTTP ${response.status}: ${response.statusText || 'Request Failed'}`,
            source: 'network',
            category: 'network',
            details: `URL: ${url}\nMethod: ${method}\nDuration: ${duration}ms`,
            httpStatus: response.status,
            httpMethod: method,
            url,
            duration,
          }, isServerError); // Only send 5xx to Sentry by default
        }

        return response;
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);
        addMessageRef.current?.({
          type: 'error',
          message: error instanceof Error ? error.message : 'Network request failed',
          source: 'network',
          category: 'network',
          details: `URL: ${url}\nMethod: ${method}\nDuration: ${duration}ms`,
          httpMethod: method,
          url,
          duration,
        });
        throw error;
      }
    };

    // Track navigation events (popstate for browser back/forward)
    const handlePopState = () => {
      logActionRef.current?.('navigation', `Navigated to ${window.location.pathname}`, window.location.href);
    };

    // Track click events on interactive elements
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Only track meaningful clicks (buttons, links, etc.)
      const clickable = target.closest('button, a, [role="button"], [data-clickable]');
      if (clickable) {
        const text = clickable.textContent?.trim().slice(0, 30) || clickable.getAttribute('aria-label') || 'element';
        const tagName = clickable.tagName.toLowerCase();
        logActionRef.current?.('click', `Clicked ${tagName}: "${text}"`, clickable.className.slice(0, 50));
      }
    };

    // Track resource loading errors (images, scripts, stylesheets)
    const handleResourceError = (event: Event) => {
      if (!config.trackResourceErrors) return;
      const target = event.target as HTMLElement;
      if (!target) return;

      // Only track actual resource elements
      const tagName = target.tagName?.toLowerCase();
      if (!['img', 'script', 'link', 'video', 'audio', 'iframe'].includes(tagName)) return;

      const src = (target as HTMLImageElement).src ||
                  (target as HTMLScriptElement).src ||
                  (target as HTMLLinkElement).href || 'unknown';

      // Skip data URLs and blob URLs
      if (src.startsWith('data:') || src.startsWith('blob:')) return;

      addMessageRef.current?.({
        type: 'error',
        message: `[RESOURCE FAILED] ${tagName.toUpperCase()} failed to load`,
        source: 'resource',
        category: 'network',
        details: `Resource: ${src}\nElement: <${tagName}>`,
        url: src,
      }, false); // Don't send to Sentry by default
    };

    // Track long tasks (main thread blocking > 50ms) via PerformanceObserver
    let longTaskObserver: PerformanceObserver | null = null;
    if (config.trackLongTasks && typeof PerformanceObserver !== 'undefined') {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = Math.round(entry.duration);
            if (duration >= config.longTaskThreshold) {
              addMessageRef.current?.({
                type: 'warning',
                message: `[LONG TASK] Main thread blocked for ${duration}ms`,
                source: 'performance',
                category: 'system',
                details: `Duration: ${duration}ms\nThreshold: ${config.longTaskThreshold}ms\nThis may cause UI jank or unresponsiveness`,
                duration,
              }, false); // Don't send to Sentry
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch {
        // Long task observation not supported in this browser
      }
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick, { capture: true });
    // Use capture phase for resource errors on window (they don't bubble)
    window.addEventListener('error', handleResourceError, { capture: true });

    // Log initial page load as navigation
    logActionRef.current?.('navigation', `Page loaded: ${window.location.pathname}`, window.location.href);

    // Log initialization in dev
    if (import.meta.env.DEV) {
      originalConsoleError.call(console, '🛡️ Debug Panel initialized (with persistence)');
    }

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('error', handleResourceError, { capture: true });
      if (longTaskObserver) {
        longTaskObserver.disconnect();
      }
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.fetch = originalFetch;
    };
  }, [
    config.trackHttpErrors,
    config.track4xxAsWarnings,
    config.trackSlowRequests,
    config.slowRequestThreshold,
    config.trackLargePayloads,
    config.largePayloadThreshold,
    config.trackLongTasks,
    config.longTaskThreshold,
    config.trackResourceErrors,
  ]);

  const addMessage = useCallback((msg: Omit<DebugMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
    addMessageInternal(msg);
  }, [addMessageInternal]);

  const clearMessages = useCallback((clearResolved = false) => {
    setMessages([]);
    setActionTrail([]);
    if (clearResolved) {
      setResolvedErrors(new Map());
    }
    if (config.persistMessages) {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.ACTION_TRAIL);
      if (clearResolved) {
        localStorage.removeItem(STORAGE_KEYS.RESOLVED_ERRORS);
      }
    }
  }, [config.persistMessages]);

  // Clear stale messages (errors/warnings that haven't recurred in threshold time)
  // Default: 5 minutes (300000ms)
  const clearStaleMessages = useCallback((staleThresholdMs = 5 * 60 * 1000) => {
    const now = Date.now();
    setMessages(prev => prev.filter(msg => {
      // Keep bookmarked messages
      if (msg.isBookmarked) return true;
      // Keep non-error/warning messages (info, websocket, etc.)
      if (msg.type !== 'error' && msg.type !== 'warning') return true;
      // Keep messages that have been seen recently
      const lastSeen = msg.lastSeen || msg.timestamp;
      return (now - lastSeen) < staleThresholdMs;
    }));
  }, []);

  // Auto-cleanup: Remove stale errors every 30 seconds
  useEffect(() => {
    const CLEANUP_INTERVAL = 30 * 1000; // 30 seconds
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        // Only run cleanup if there are messages to clean
        const staleCount = prev.filter(msg => {
          if (msg.isBookmarked) return false;
          if (msg.type !== 'error' && msg.type !== 'warning') return false;
          const lastSeen = msg.lastSeen || msg.timestamp;
          return (now - lastSeen) >= STALE_THRESHOLD;
        }).length;

        // If no stale messages, don't trigger a state update
        if (staleCount === 0) return prev;

        // Filter out stale messages
        return prev.filter(msg => {
          if (msg.isBookmarked) return true;
          if (msg.type !== 'error' && msg.type !== 'warning') return true;
          const lastSeen = msg.lastSeen || msg.timestamp;
          return (now - lastSeen) < STALE_THRESHOLD;
        });
      });
    }, CLEANUP_INTERVAL);

    return () => clearInterval(cleanupInterval);
  }, []);

  const toggleBookmark = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, isBookmarked: !msg.isBookmarked } : msg
      )
    );
  }, []);

  const acknowledgeErrors = useCallback(() => {
    setMessages(prev =>
      prev.map(msg =>
        msg.type === 'error' ? { ...msg, isAcknowledged: true } : msg
      )
    );
  }, []);

  const acknowledgeMessage = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, isAcknowledged: true } : msg
      )
    );
  }, []);

  const logAction = useCallback((
    action: ActionTrailEntry['action'],
    description: string,
    details?: string
  ) => {
    logActionInternal(action, description, details);
  }, [logActionInternal]);

  /**
   * Log WebSocket events with categorization
   */
  const logWebSocket = useCallback((
    messageType: string,
    data: unknown,
    wsCategory?: DebugMessage['wsCategory']
  ) => {
    // Auto-detect category if not provided
    let category = wsCategory;
    if (!category) {
      if (messageType.includes('generation') || messageType.includes('gen_')) {
        category = 'generation';
      } else if (messageType.includes('phase')) {
        category = 'phase';
      } else if (messageType.includes('file')) {
        category = 'file';
      } else if (messageType.includes('deploy') || messageType.includes('cloudflare')) {
        category = 'deployment';
      } else if (messageType.includes('connect') || messageType.includes('disconnect')) {
        category = 'connection';
      } else {
        category = 'system';
      }
    }

    // Determine message type (error detection)
    const isError = messageType.includes('error') || messageType.includes('fail');
    const type: DebugMessage['type'] = isError ? 'error' : 'websocket';

    addMessageInternal({
      type,
      message: messageType,
      source: 'websocket',
      category: 'websocket',
      wsCategory: category,
      messageType,
      rawMessage: data,
      details: typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data),
    }, isError); // Only send errors to Sentry
  }, [addMessageInternal]);

  /**
   * Mark an error as resolved with optional note
   */
  const resolveError = useCallback((messageId: string, note?: string) => {
    setMessages(prev => {
      const msg = prev.find(m => m.id === messageId);
      if (!msg || msg.type !== 'error' || !msg.errorSignature) return prev;

      // Add to resolved errors registry
      const signature = msg.errorSignature;
      setResolvedErrors(prevResolved => {
        const updated = new Map(prevResolved);
        updated.set(signature, {
          signature,
          originalMessage: msg.message,
          resolvedAt: Date.now(),
          resolutionNote: note,
          recurrenceCount: 0,
          appStateAtResolution: msg.appStateSnapshot,
        });
        return updated;
      });

      // Update the message status
      return prev.map(m =>
        m.id === messageId
          ? { ...m, resolutionStatus: 'resolved' as ResolutionStatus, resolvedAt: Date.now(), resolutionNote: note }
          : m
      );
    });
  }, []);

  /**
   * Mark an error as unresolved (reopen it)
   */
  const unresolveError = useCallback((messageId: string) => {
    setMessages(prev => {
      const msg = prev.find(m => m.id === messageId);
      if (!msg || msg.type !== 'error' || !msg.errorSignature) return prev;

      // Remove from resolved errors registry
      const signature = msg.errorSignature;
      setResolvedErrors(prevResolved => {
        const updated = new Map(prevResolved);
        updated.delete(signature);
        return updated;
      });

      // Update the message status
      return prev.map(m =>
        m.id === messageId
          ? { ...m, resolutionStatus: 'active' as ResolutionStatus, resolvedAt: undefined, resolutionNote: undefined }
          : m
      );
    });
  }, []);

  /**
   * Get resolution history for a given error signature
   */
  const getResolutionHistory = useCallback((signature: string): ResolvedErrorRecord | undefined => {
    return resolvedErrors.get(signature);
  }, [resolvedErrors]);

  /**
   * Ignore a message pattern (won't be shown in future)
   */
  const ignoreMessage = useCallback((messageId: string, reason?: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // Generate a signature for the message pattern
    const signature = generateErrorSignature(msg.message, msg.source, msg.category);

    setIgnoredPatterns(prev => {
      const updated = new Map(prev);
      updated.set(signature, {
        signature,
        pattern: msg.message.slice(0, 100), // Store first 100 chars for display
        ignoredAt: Date.now(),
        reason,
        type: msg.type === 'error' ? 'error' : msg.type === 'warning' ? 'warning' : msg.type === 'info' ? 'info' : 'all',
      });
      return updated;
    });
  }, [messages]);

  /**
   * Remove a pattern from the ignore list
   */
  const unignorePattern = useCallback((signature: string) => {
    setIgnoredPatterns(prev => {
      const updated = new Map(prev);
      updated.delete(signature);
      return updated;
    });
  }, []);

  /**
   * Check if a message matches an ignored pattern
   */
  const isMessageIgnored = useCallback((message: DebugMessage): boolean => {
    const signature = generateErrorSignature(message.message, message.source, message.category);
    return ignoredPatterns.has(signature);
  }, [ignoredPatterns]);

  /**
   * Add an ignore pattern directly (without needing a specific message ID)
   * Useful for pre-defined patterns like "Mute Long Tasks"
   */
  const addIgnorePattern = useCallback((message: string, source?: string, category?: string, reason?: string) => {
    const signature = generateErrorSignature(message, source, category);

    setIgnoredPatterns(prev => {
      const updated = new Map(prev);
      updated.set(signature, {
        signature,
        pattern: message.slice(0, 100),
        ignoredAt: Date.now(),
        reason,
        type: 'all',
      });
      return updated;
    });
  }, []);

  return (
    <DebugPanelContext.Provider value={{
      messages,
      actionTrail,
      unacknowledgedCount,
      resolvedErrors,
      ignoredPatterns,
      addMessage,
      logAction,
      logWebSocket,
      clearMessages,
      clearStaleMessages,
      toggleBookmark,
      acknowledgeErrors,
      acknowledgeMessage,
      // Resolution tracking
      resolveError,
      unresolveError,
      getResolutionHistory,
      // Ignore patterns
      ignoreMessage,
      addIgnorePattern,
      unignorePattern,
      isMessageIgnored,
    }}>
      {children}
    </DebugPanelContext.Provider>
  );
}

export function useDebugPanel() {
  const ctx = useContext(DebugPanelContext);
  if (!ctx) {
    throw new Error('useDebugPanel must be used within DebugPanelProvider');
  }
  return ctx;
}

/**
 * Helper to log debug messages from anywhere
 * Can be used outside of React components
 */
let globalAddMessage: DebugPanelContextType['addMessage'] | null = null;
let globalLogAction: DebugPanelContextType['logAction'] | null = null;
let globalLogWebSocket: DebugPanelContextType['logWebSocket'] | null = null;

export function setGlobalDebugLogger(
  addMessage: DebugPanelContextType['addMessage'],
  logAction?: DebugPanelContextType['logAction'],
  logWebSocket?: DebugPanelContextType['logWebSocket']
) {
  globalAddMessage = addMessage;
  globalLogAction = logAction || null;
  globalLogWebSocket = logWebSocket || null;
}

export function debugLog(
  type: DebugMessage['type'],
  message: string,
  options?: Partial<Omit<DebugMessage, 'id' | 'timestamp' | 'type' | 'message'>>
) {
  if (globalAddMessage) {
    globalAddMessage({ type, message, ...options });
  }
}

export function debugAction(
  action: ActionTrailEntry['action'],
  description: string,
  details?: string
) {
  if (globalLogAction) {
    globalLogAction(action, description, details);
  }
}

export function debugWebSocket(
  messageType: string,
  data: unknown,
  wsCategory?: DebugMessage['wsCategory']
) {
  if (globalLogWebSocket) {
    globalLogWebSocket(messageType, data, wsCategory);
  }
}

/**
 * Hook for tracking rapid state changes (detects infinite loops)
 * Use: const trackState = useStateTracker('MyComponent');
 *      trackState('counterState', counter);
 */
export function useStateTracker(componentName: string, threshold = 20, windowMs = 500) {
  const { logAction, addMessage } = useDebugPanel();
  const stateChanges = useRef<Map<string, number[]>>(new Map());

  return useCallback((stateName: string, _value?: unknown) => {
    const now = Date.now();
    const key = `${componentName}:${stateName}`;

    // Get or create change history for this state
    let changes = stateChanges.current.get(key);
    if (!changes) {
      changes = [];
      stateChanges.current.set(key, changes);
    }

    // Add current timestamp
    changes.push(now);

    // Remove timestamps outside the window
    const cutoff = now - windowMs;
    while (changes.length > 0 && changes[0] < cutoff) {
      changes.shift();
    }

    // Check for rapid changes
    if (changes.length >= threshold) {
      const message = `[RAPID STATE] ${componentName}.${stateName} changed ${changes.length} times in ${windowMs}ms`;

      addMessage({
        type: 'warning',
        message,
        source: 'state-tracker',
        category: 'react',
        details: `Component: ${componentName}\nState: ${stateName}\nChanges: ${changes.length} in ${windowMs}ms\nPossible infinite loop detected`,
      });

      logAction('state_change', message, `Threshold: ${threshold}, Window: ${windowMs}ms`);

      // Reset after warning to avoid spam
      stateChanges.current.set(key, []);
    }
  }, [componentName, threshold, windowMs, logAction, addMessage]);
}

/**
 * Hook for tracking React Router navigation
 * Usage: Add useNavigationTracker() to your Router component
 */
export function useNavigationTracker() {
  const { logAction } = useDebugPanel();
  const prevPath = useRef(window.location.pathname);

  useEffect(() => {
    // Check for pathname changes periodically (for SPA navigation)
    const checkNavigation = () => {
      const currentPath = window.location.pathname;
      if (currentPath !== prevPath.current) {
        logAction('navigation', `Navigated to ${currentPath}`, `From: ${prevPath.current}`);
        prevPath.current = currentPath;
      }
    };

    // Use MutationObserver to detect DOM changes that might indicate navigation
    const observer = new MutationObserver(checkNavigation);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [logAction]);
}
