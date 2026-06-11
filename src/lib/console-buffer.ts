import type { DebugMessage } from '@/components/debug-panel';

/**
 * Console buffer derivation for support tickets (D-03, CAP-01).
 *
 * Pure module: no React, no side effects, no console interception — the
 * globally-mounted DebugPanelProvider already intercepts console/error/network
 * signals (15-RESEARCH anti-pattern: never add a second interceptor). This
 * module derives a bounded, error-prioritized snapshot of those messages at
 * ticket-submit time.
 */

const DEFAULT_CAP = 100;
const MESSAGE_MAX_CHARS = 500;
const STACK_MAX_CHARS = 2000;

/**
 * Trimmed allowlist shape persisted into the console_log attachment.
 * Heavy/sensitive fields (responseBody, appStateSnapshot, rawMessage, details)
 * are deliberately STRIPPED — T-15-06 information-disclosure mitigation.
 */
export interface ConsoleBufferEntry {
  timestamp: number;
  type: DebugMessage['type'];
  message: string;
  source?: string;
  stack?: string;
  httpStatus?: number;
  url?: string;
}

function toEntry(message: DebugMessage): ConsoleBufferEntry {
  const entry: ConsoleBufferEntry = {
    timestamp: message.timestamp,
    type: message.type,
    message: (message.message ?? '').slice(0, MESSAGE_MAX_CHARS),
  };

  if (message.source !== undefined) entry.source = message.source;
  if (message.stack !== undefined) entry.stack = message.stack.slice(0, STACK_MAX_CHARS);
  if (message.httpStatus !== undefined) entry.httpStatus = message.httpStatus;
  if (message.url !== undefined) entry.url = message.url;

  return entry;
}

/**
 * Derives a bounded ring-buffer snapshot from the debug-panel messages:
 * - At most `cap` entries (default 100; T-15-05 size mitigation)
 * - Error entries are retained preferentially: ALL errors survive trimming
 *   (most recent `cap` errors if errors alone exceed the cap)
 * - Remaining slots fill with the MOST RECENT non-error entries
 * - Output sorted by timestamp ascending (chronological read order)
 * - Each entry mapped to the trimmed allowlist shape with truncation
 */
export function deriveConsoleBuffer(messages: DebugMessage[], cap = DEFAULT_CAP): ConsoleBufferEntry[] {
  const byTimestamp = (a: DebugMessage, b: DebugMessage) => a.timestamp - b.timestamp;

  const errors = messages.filter((m) => m.type === 'error').sort(byTimestamp);
  const nonErrors = messages.filter((m) => m.type !== 'error').sort(byTimestamp);

  // Errors first: keep the most recent `cap` errors if over the cap.
  const keptErrors = errors.length > cap ? errors.slice(errors.length - cap) : errors;

  // Fill remaining slots with the most recent non-errors.
  const remaining = cap - keptErrors.length;
  const keptNonErrors = remaining > 0 ? nonErrors.slice(Math.max(0, nonErrors.length - remaining)) : [];

  return [...keptErrors, ...keptNonErrors].sort(byTimestamp).map(toEntry);
}

/**
 * Serializes a derived buffer to an application/json Blob suitable for upload
 * as a `console_log` ticket attachment. An empty buffer serializes cleanly —
 * a ticket with zero console history is itself signal, never an error.
 */
export function serializeConsoleBuffer(entries: ConsoleBufferEntry[]): Blob {
  const payload = {
    capturedAt: new Date().toISOString(),
    entries,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}
