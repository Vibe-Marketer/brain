/**
 * Chat Types
 * Types for chat streaming, filters, and message handling
 */

import type { UIMessage } from 'ai';

// ==================== Filter Types ====================

/**
 * Chat session filters for narrowing transcript search
 */
export interface ChatFilters {
  dateStart?: Date;
  dateEnd?: Date;
  speakers: string[];
  categories: string[];
  recordingIds: number[];
}

/**
 * API-formatted filters for chat-stream endpoint
 */
export interface ChatApiFilters {
  date_start?: string;
  date_end?: string;
  speakers?: string[];
  categories?: string[];
  recording_ids?: number[];
}

/**
 * Navigation state passed when routing to chat
 */
export interface ChatLocationState {
  prefilter?: {
    recordingIds?: number[];
  };
  callTitle?: string;
  newSession?: boolean;
  initialContext?: ContextAttachment[];
}

// ==================== Context Attachment Types ====================

/**
 * Attachment added to chat context (calls attached via "+ Add context")
 */
export interface ContextAttachment {
  type: 'call';
  id: number;
  title: string;
  date: string;
}

// ==================== Speaker/Category/Call Types ====================

/**
 * Speaker data from get_user_speakers RPC
 */
export interface ChatSpeaker {
  speaker_name: string;
  speaker_email: string;
  call_count: number;
}

/**
 * Category data from get_user_categories RPC
 */
export interface ChatCategory {
  category: string;
  call_count: number;
}

/**
 * Call data for filter and mention lists
 */
export interface ChatCall {
  recording_id: number;
  title: string;
  created_at: string;
}

// ==================== Tool Call Types ====================

/**
 * Tool call result from search tools
 */
export interface ToolCallResult {
  results?: Array<{
    recording_id: number;
    text: string;
    speaker: string;
    call_date: string;
    call_title: string;
    relevance: string;
  }>;
  [key: string]: unknown;
}

/**
 * Tool call part extracted from AI SDK message
 */
export interface ToolCallPart {
  type: string;
  toolName: string;
  toolCallId: string;
  state?: 'pending' | 'running' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: ToolCallResult;
  error?: string;
}

// ==================== Connection State Types ====================

/**
 * Connection states for streaming
 */
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'rate-limited';

/**
 * Streaming state for the chat
 */
export interface StreamingState {
  isReconnecting: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  isRateLimited: boolean;
  rateLimitCooldownEnd: number | null;
  rateLimitSeconds: number;
}

// ==================== Helper Functions ====================

/**
 * Extract text content from message parts
 */
export function getMessageTextContent(message: UIMessage): string {
  if (!message?.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part?.type === 'text' && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('');
}

/**
 * Extract tool invocations from message parts
 * AI SDK v5 states: 'input-streaming', 'input-available', 'output-available', 'output-error'
 */
export function getToolInvocations(message: UIMessage): ToolCallPart[] {
  if (!message?.parts || !Array.isArray(message.parts)) return [];

  const toolParts: ToolCallPart[] = [];

  for (const part of message.parts) {
    if (!part || typeof part.type !== 'string') continue;
    // AI SDK v5 tool parts have type like 'tool-searchTranscripts', 'tool-getCallDetails', etc.
    // Also handle 'dynamic-tool' for dynamic tools
    if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
      const toolPart = part as {
        type: string;
        toolCallId: string;
        toolName?: string; // Present for dynamic-tool type
        state: string;
        input?: unknown;
        output?: unknown;
        errorText?: string;
      };

      // Extract tool name from type (e.g., 'tool-searchTranscripts' -> 'searchTranscripts')
      // For dynamic-tool, use the toolName property
      const toolName =
        part.type === 'dynamic-tool'
          ? toolPart.toolName || 'unknown'
          : toolPart.type.replace('tool-', '');

      // Map AI SDK v5 states to our UI states
      // AI SDK v5 states: 'input-streaming', 'input-available', 'output-available', 'output-error'
      let state: 'pending' | 'running' | 'success' | 'error' = 'pending';
      if (toolPart.state === 'input-streaming') {
        state = 'running';
      } else if (toolPart.state === 'input-available') {
        state = 'running'; // Still running, waiting for output
      } else if (toolPart.state === 'output-available') {
        state = 'success';
      } else if (toolPart.state === 'output-error') {
        state = 'error';
      }

      toolParts.push({
        type:
          toolPart.state === 'output-available' ? 'tool-result' : 'tool-call',
        toolName,
        toolCallId: toolPart.toolCallId,
        state,
        args: toolPart.input as Record<string, unknown>,
        result:
          toolPart.state === 'output-available'
            ? (toolPart.output as ToolCallResult)
            : undefined,
        error: toolPart.errorText,
      });
    }
  }

  return toolParts;
}
