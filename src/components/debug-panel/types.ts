/**
 * Debug Panel Types
 *
 * Shared types for the debug panel system.
 */

export interface DebugMessage {
  id: string;
  timestamp: number;
  type: 'error' | 'warning' | 'info' | 'network' | 'console';
  message: string;
  details?: string;
  source?: string;
  messageType?: string;
  rawMessage?: unknown;
  category?: 'api' | 'auth' | 'sync' | 'ui' | 'network' | 'system' | 'react';
  duration?: number; // Time since previous message
  isBookmarked?: boolean;
  stack?: string;
  componentStack?: string;
  sentToSentry?: boolean;
  performance?: {
    tokens?: number;
    fileCount?: number;
    memoryUsage?: number;
  };
}

export interface DebugDump {
  timestamp: number;
  sessionId: string;
  messages: DebugMessage[];
  appState: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
  };
  screenshot?: string;
}

export type MessageFilter = 'all' | 'error' | 'warning' | 'info' | 'network' | 'console';
export type CategoryFilter = 'all' | 'api' | 'auth' | 'sync' | 'ui' | 'network' | 'system' | 'react';
export type ViewMode = 'list' | 'timeline' | 'analytics';
