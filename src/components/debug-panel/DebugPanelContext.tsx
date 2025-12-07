/**
 * Debug Panel Context
 *
 * Global state management for debug messages.
 * Provides addMessage() for logging from anywhere in the app.
 * Integrates with Sentry for production error tracking.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import type { DebugMessage } from './types';

const MAX_MESSAGES = 500; // Limit to prevent memory issues

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

interface DebugPanelContextType {
  messages: DebugMessage[];
  addMessage: (msg: Omit<DebugMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  clearMessages: () => void;
  toggleBookmark: (messageId: string) => void;
}

const DebugPanelContext = createContext<DebugPanelContextType | undefined>(undefined);

let messageCounter = 0;

function generateId(): string {
  messageCounter = (messageCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${messageCounter}`;
}

// Flag to prevent recursive capture
let isCapturing = false;

export function DebugPanelProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const isInitialized = useRef(false);
  const addMessageRef = useRef<typeof addMessageInternal | null>(null);

  // Internal add function
  const addMessageInternal = useCallback((
    msg: Omit<DebugMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
    sendToSentry = true
  ) => {
    // Ignore certain messages
    if (shouldIgnore(msg.message)) return;

    const newMessage: DebugMessage = {
      ...msg,
      id: msg.id || generateId(),
      timestamp: msg.timestamp || Date.now(),
      isBookmarked: false,
    };

    // Send errors to Sentry
    if (sendToSentry && msg.type === 'error') {
      Sentry.withScope((scope) => {
        scope.setTag('source', msg.source || 'unknown');
        scope.setTag('category', msg.category || 'system');
        if (msg.stack) {
          scope.setExtra('stack', msg.stack);
        }
        Sentry.captureMessage(msg.message, 'error');
      });
      newMessage.sentToSentry = true;
    }

    setMessages(prev => {
      const updated = [...prev, newMessage];
      if (updated.length > MAX_MESSAGES) {
        return updated.slice(-MAX_MESSAGES);
      }
      return updated;
    });
  }, []);

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
      const message = reason instanceof Error ? reason.message : String(reason);
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
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        // Skip internal logs
        if (message.includes('[ERROR]') || message.includes('Debug Panel')) {
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
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

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

    // Intercept fetch for network errors
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const response = await originalFetch.call(window, input, init);

        // Capture server errors (5xx)
        if (response.status >= 500) {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
          addMessageRef.current?.({
            type: 'error',
            message: `HTTP ${response.status}: ${response.statusText}`,
            source: 'network',
            category: 'network',
            details: `URL: ${url}\nMethod: ${init?.method || 'GET'}`,
          });
        }

        return response;
      } catch (error) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
        addMessageRef.current?.({
          type: 'error',
          message: error instanceof Error ? error.message : 'Network request failed',
          source: 'network',
          category: 'network',
          details: `URL: ${url}\nMethod: ${init?.method || 'GET'}`,
        });
        throw error;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Log initialization in dev
    if (import.meta.env.DEV) {
      originalConsoleError.call(console, '🛡️ Debug Panel initialized');
    }

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.fetch = originalFetch;
    };
  }, []);

  const addMessage = useCallback((msg: Omit<DebugMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
    addMessageInternal(msg);
  }, [addMessageInternal]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleBookmark = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, isBookmarked: !msg.isBookmarked } : msg
      )
    );
  }, []);

  return (
    <DebugPanelContext.Provider value={{ messages, addMessage, clearMessages, toggleBookmark }}>
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

export function setGlobalDebugLogger(addMessage: DebugPanelContextType['addMessage']) {
  globalAddMessage = addMessage;
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
