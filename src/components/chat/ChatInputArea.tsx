/**
 * ChatInputArea - Input handling and filters UI
 * 
 * Handles the chat input area including:
 * - PromptInput with textarea
 * - Context attachments bar
 * - Model selector
 * - Mentions popover
 * - Keyboard hints
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  RiSendPlaneFill,
  RiAtLine,
  RiVideoLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputContextBar,
  PromptInputFooter,
  PromptInputFooterLeft,
  PromptInputFooterRight,
  PromptInputHintBar,
  KeyboardHint,
  type ContextAttachment,
} from '@/components/chat/prompt-input';
import { ModelSelector } from '@/components/chat/model-selector';
import type { ChatCall } from '@/types/chat';

// ==================== Props Interface ====================

export interface ChatInputAreaProps {
  /** Current input value */
  input: string;
  /** Callback when input changes (handles mentions) */
  onInputChange: (value: string) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Whether streaming/loading is in progress */
  isLoading: boolean;
  /** Whether chat is ready to send */
  isChatReady: boolean;
  /** Whether rate limited */
  isRateLimited: boolean;
  /** Seconds remaining in rate limit */
  rateLimitSeconds: number;
  /** Whether reconnecting */
  isReconnecting: boolean;
  /** Current reconnect attempt number */
  reconnectAttemptDisplay: number;
  /** Max reconnect attempts */
  maxReconnectAttempts: number;
  /** Selected model ID */
  selectedModel: string;
  /** Callback when model changes */
  onModelChange: (model: string) => void;
  /** Context attachments */
  contextAttachments: ContextAttachment[];
  /** Callback to remove attachment */
  onRemoveAttachment: (id: number) => void;
  /** Available calls for attachment */
  availableCalls: ChatCall[];
  /** Callback to add call attachment */
  onAddCall: (call: ChatCall) => void;
  /** Whether to show mentions popover */
  showMentions: boolean;
  /** Filtered calls for mentions */
  filteredCalls: ChatCall[];
  /** Callback when mention is selected */
  onMentionSelect: (call: ChatCall) => void;
  /** Ref for textarea (for mentions) */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

// ==================== Component ====================

/**
 * ChatInputArea component
 * 
 * Renders the chat input area with:
 * - Mentions popover for @-mentioning calls
 * - Context bar with attachments
 * - Textarea for input
 * - Model selector
 * - Submit button
 * - Keyboard hints
 */
export function ChatInputArea({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isChatReady,
  isRateLimited,
  rateLimitSeconds,
  isReconnecting,
  reconnectAttemptDisplay,
  maxReconnectAttempts,
  selectedModel,
  onModelChange,
  contextAttachments,
  onRemoveAttachment,
  availableCalls,
  onAddCall,
  showMentions,
  filteredCalls,
  onMentionSelect,
  textareaRef,
}: ChatInputAreaProps): React.ReactElement {
  // Compute placeholder text
  const placeholder = React.useMemo(() => {
    if (!isChatReady) {
      return 'Chat unavailable - please sign in';
    }
    if (isRateLimited) {
      return `Rate limited - please wait ${rateLimitSeconds}s...`;
    }
    if (isReconnecting) {
      return `Reconnecting (attempt ${reconnectAttemptDisplay}/${maxReconnectAttempts})...`;
    }
    return 'Ask about your transcripts... (type @ to mention a call)';
  }, [isChatReady, isRateLimited, rateLimitSeconds, isReconnecting, reconnectAttemptDisplay, maxReconnectAttempts]);

  // Compute button text
  const buttonText = React.useMemo(() => {
    if (isRateLimited) {
      return `Wait ${rateLimitSeconds}s`;
    }
    if (isReconnecting) {
      return 'Reconnecting...';
    }
    return 'Send';
  }, [isRateLimited, rateLimitSeconds, isReconnecting]);

  // Check if input is disabled
  const isDisabled = isLoading || !isChatReady || isRateLimited || isReconnecting;

  // Check if submit is disabled
  const isSubmitDisabled = !input || !input.trim() || isDisabled;

  return (
    <div className="relative w-full">
      {/* Mentions popover */}
      {showMentions && filteredCalls.length > 0 && (
        <MentionsPopover
          calls={filteredCalls}
          onSelect={onMentionSelect}
        />
      )}

      <PromptInput
        value={input}
        onValueChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={isLoading}
      >
        {/* Context Bar with call attachments */}
        <PromptInputContextBar
          attachments={contextAttachments}
          onRemoveAttachment={onRemoveAttachment}
          availableCalls={availableCalls}
          onAddCall={onAddCall}
        />

        {/* Main textarea */}
        <PromptInputTextarea
          ref={textareaRef}
          placeholder={placeholder}
          disabled={isDisabled}
          className="px-4 py-2"
        />

        {/* Footer with model selector and submit */}
        <PromptInputFooter>
          <PromptInputFooterLeft>
            <ModelSelector
              value={selectedModel}
              onValueChange={onModelChange}
            />
          </PromptInputFooterLeft>
          <PromptInputFooterRight>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitDisabled}
              className="gap-1"
            >
              <RiSendPlaneFill className="h-4 w-4" />
              {buttonText}
            </Button>
          </PromptInputFooterRight>
        </PromptInputFooter>
      </PromptInput>

      {/* Keyboard Hint Bar */}
      <PromptInputHintBar>
        <KeyboardHint label="Send with" shortcut="Enter" />
        <KeyboardHint label="New line" shortcut="Shift+Enter" />
      </PromptInputHintBar>
    </div>
  );
}

// ==================== Sub-components ====================

interface MentionsPopoverProps {
  calls: ChatCall[];
  onSelect: (call: ChatCall) => void;
}

function MentionsPopover({ calls, onSelect }: MentionsPopoverProps): React.ReactElement {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-lg border border-border shadow-lg max-h-64 overflow-y-auto z-50">
      <div className="p-2">
        <div className="text-xs font-medium text-ink-muted uppercase mb-2 px-2">
          <RiAtLine className="inline h-3 w-3 mr-1" />
          Mention a call
        </div>
        <div className="space-y-1">
          {calls.map((call) => (
            <button
              key={call.recording_id}
              onClick={() => onSelect(call)}
              className="w-full flex items-start gap-2 rounded-md px-2 py-2 hover:bg-hover transition-colors text-left"
            >
              <RiVideoLine className="h-4 w-4 text-ink-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink font-medium truncate">
                  {call.title || 'Untitled Call'}
                </div>
                <div className="text-xs text-ink-muted">
                  {format(new Date(call.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
