/**
 * Debug Panel Module
 *
 * Portable "Sentry-in-a-Box" debugging console with:
 * - Comprehensive error tracking (JS exceptions, network, console)
 * - localStorage persistence (survives refresh)
 * - User journey tracking (navigation, clicks, API calls)
 * - WebSocket event logging
 * - Rapid state change detection (infinite loop detection)
 * - Markdown export for AI-assisted debugging
 *
 * See INSTALLATION.md for setup instructions.
 */

// Main components
export { DebugPanel } from './DebugPanel';

// Context and hooks
export {
  DebugPanelProvider,
  useDebugPanel,
  useStateTracker,
  useNavigationTracker,
  // Global logging functions (for non-React code)
  setGlobalDebugLogger,
  debugLog,
  debugAction,
  debugWebSocket,
} from './DebugPanelContext';

// Types
export type {
  DebugMessage,
  DebugDump,
  EnhancedDebugDump,
  ActionTrailEntry,
  MessageFilter,
  CategoryFilter,
  ViewMode,
  DebugPanelConfig,
  IgnoredPattern,
} from './types';

// Constants
export { STORAGE_KEYS } from './types';

// Utilities
export {
  formatAsMarkdown,
  generateSummary,
  groupErrors,
  parseUserAgent,
  calculateTimeSpan,
  parseStackTrace,
} from './debug-dump-utils';
