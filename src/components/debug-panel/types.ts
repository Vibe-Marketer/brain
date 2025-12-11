/**
 * Debug Panel Types
 *
 * Shared types for the debug panel system.
 */

// Resolution status for error tracking lifecycle
export type ResolutionStatus = 'active' | 'resolved' | 'recurring';

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
  // Resolution tracking
  errorSignature?: string;        // Unique fingerprint to identify "same" error
  resolutionStatus?: ResolutionStatus;
  resolvedAt?: number;            // Timestamp when marked resolved
  resolutionNote?: string;        // What was done to fix it
  recurrenceCount?: number;       // How many times this recurred after resolution
  originalErrorId?: string;       // Links to the original resolved error
  appStateSnapshot?: AppStateSnapshot; // State when error occurred
}

// Snapshot of app state when error occurred (for comparison)
export interface AppStateSnapshot {
  url: string;
  timestamp: number;
  recentActions: string[];        // Last 5 actions before error
  activeComponent?: string;       // Current route/component if known
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
export type ViewMode = 'list' | 'timeline' | 'analytics' | 'webhooks';

// Resolved error record for tracking recurrence
export interface ResolvedErrorRecord {
  signature: string;              // Error fingerprint
  originalMessage: string;        // Original error message
  resolvedAt: number;             // When it was resolved
  resolutionNote?: string;        // What was done to fix
  recurrenceCount: number;        // Times it recurred after resolution
  lastRecurrence?: number;        // Last time it recurred
  appStateAtResolution?: AppStateSnapshot;
}

// Ignored pattern record
export interface IgnoredPattern {
  signature: string;              // Message fingerprint
  pattern: string;                // Original message pattern (for display)
  ignoredAt: number;              // When it was ignored
  reason?: string;                // Why it was ignored (optional note)
  type: 'error' | 'warning' | 'info' | 'all'; // What type was ignored
}

// Storage keys for localStorage persistence
export const STORAGE_KEYS = {
  MESSAGES: 'debug_panel_messages',
  ACTION_TRAIL: 'debug_panel_action_trail',
  UNACKNOWLEDGED_COUNT: 'debug_panel_unack_count',
  SESSION_ID: 'debug_panel_session_id',
  RESOLVED_ERRORS: 'debug_panel_resolved_errors', // Track resolved errors for recurrence detection
  IGNORED_PATTERNS: 'debug_panel_ignored_patterns', // Track ignored message patterns
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
  longTaskThreshold?: number;     // Threshold in ms (default: 150 - relaxed from 50ms standard)
  trackResourceErrors?: boolean;  // Track failed images/scripts/CSS (default: true)
}
