/**
 * Debug Panel Types
 *
 * Shared types for the debug panel system.
 */

export interface DebugMessage {
  id: string;
  timestamp: number;
  type: 'error' | 'warning' | 'info' | 'network' | 'console' | 'websocket';
  message: string;
  details?: string;
  source?: string;
  messageType?: string;
  rawMessage?: unknown;
  category?: 'api' | 'auth' | 'sync' | 'ui' | 'network' | 'system' | 'react' | 'websocket';
  // WebSocket-specific categorization
  wsCategory?: 'generation' | 'phase' | 'file' | 'deployment' | 'system' | 'connection';
  duration?: number; // Time since previous message
  isBookmarked?: boolean;
  isAcknowledged?: boolean; // For error acknowledgment system
  stack?: string;
  componentStack?: string;
  sentToSentry?: boolean;
  performance?: {
    tokens?: number;
    fileCount?: number;
    memoryUsage?: number;
  };
  // HTTP-specific metadata
  httpStatus?: number;
  httpMethod?: string;
  url?: string;
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

// Enhanced dump format for Claude Code consumption
export interface ActionTrailEntry {
  timestamp: number;
  action: 'navigation' | 'click' | 'api_call' | 'state_change' | 'user_input';
  description: string;
  details?: string;
}

export interface EnhancedDebugDump extends DebugDump {
  generatedAt: string; // ISO timestamp
  summary: {
    totalMessages: number;
    errors: number;
    warnings: number;
    info: number;
    uniqueErrors: number;
    timeSpan: string;
    topIssue: string | null;
  };
  environment: {
    browser: string;
    os: string;
    viewport: { width: number; height: number };
  };
  actionTrail?: ActionTrailEntry[];
}

export type MessageFilter = 'all' | 'error' | 'warning' | 'info' | 'network' | 'console' | 'websocket';
export type CategoryFilter = 'all' | 'api' | 'auth' | 'sync' | 'ui' | 'network' | 'system' | 'react' | 'websocket';
export type ViewMode = 'list' | 'timeline' | 'analytics';

// Storage keys for localStorage persistence
export const STORAGE_KEYS = {
  MESSAGES: 'debug_panel_messages',
  ACTION_TRAIL: 'debug_panel_action_trail',
  UNACKNOWLEDGED_COUNT: 'debug_panel_unack_count',
  SESSION_ID: 'debug_panel_session_id',
} as const;

// Configuration for the debug panel
export interface DebugPanelConfig {
  maxMessages?: number;           // Max messages to keep (default: 500)
  maxActions?: number;            // Max action trail entries (default: 50)
  persistMessages?: boolean;      // Save to localStorage (default: true)
  persistedMessageLimit?: number; // Max messages to persist (default: 100)
  trackHttpErrors?: boolean;      // Track 4xx/5xx errors (default: true)
  track4xxAsWarnings?: boolean;   // Log 4xx as warnings (default: true)
  enableSentry?: boolean;         // Send errors to Sentry (default: true)
  rapidStateThreshold?: number;   // Threshold for rapid state detection (default: 20)
  rapidStateWindow?: number;      // Time window in ms (default: 500)
  // Performance tracking
  trackSlowRequests?: boolean;    // Warn on slow API calls (default: true)
  slowRequestThreshold?: number;  // Threshold in ms (default: 3000)
  trackLargePayloads?: boolean;   // Warn on large responses (default: true)
  largePayloadThreshold?: number; // Threshold in bytes (default: 1MB = 1048576)
  trackLongTasks?: boolean;       // Detect main thread blocking (default: true)
  longTaskThreshold?: number;     // Threshold in ms (default: 50)
  trackResourceErrors?: boolean;  // Track failed images/scripts/CSS (default: true)
}
