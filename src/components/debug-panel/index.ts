/**
 * Debug Panel Module
 *
 * Admin-only debugging console with comprehensive error tracking,
 * analytics, timeline view, and debug dump export.
 */

export { DebugPanel } from './DebugPanel';
export { DebugPanelProvider, useDebugPanel, debugLog } from './DebugPanelContext';
export type { DebugMessage, DebugDump, MessageFilter, CategoryFilter, ViewMode } from './types';
