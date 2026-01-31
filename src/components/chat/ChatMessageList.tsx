/**
 * ChatMessageList - Message rendering component
 * 
 * Renders user and assistant messages with tool calls, sources, and citations.
 * Extracted from Chat.tsx for better separation of concerns.
 */

import * as React from 'react';
import type { UIMessage } from 'ai';
import { UserMessage, AssistantMessage, extractSourcesFromParts, citationSourcesToSourceData } from '@/components/chat/message';
import { ThinkingLoader } from '@/components/chat/loader';
import { SourceList } from '@/components/chat/source';
import { ToolCalls } from '@/components/chat/tool-call';
import { ChatLoading } from '@/components/chat/chat-skeleton';
import { ChatWelcome } from '@/components/chat/chat-welcome';
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/chat/chat-container';
import { ScrollButton } from '@/components/chat/scroll-button';
import { RiUploadCloud2Line } from '@remixicon/react';
import { getMessageTextContent, getToolInvocations, type ToolCallPart } from '@/types/chat';

// ==================== Props Interface ====================

export interface ChatMessageListProps {
  /** Messages to render */
  messages: UIMessage[];
  /** Whether messages are loading from database */
  isLoadingMessages: boolean;
  /** Whether streaming is in progress */
  isLoading: boolean;
  /** Whether chat is ready to send messages */
  isChatReady: boolean;
  /** User name for welcome message */
  userName?: string;
  /** Whether user has any transcripts */
  hasTranscripts: boolean;
  /** IDs of messages that were interrupted mid-stream */
  incompleteMessageIds: Set<string>;
  /** Callback when clicking a call citation */
  onCallClick: (recordingId: number) => void;
  /** Callback when clicking retry on incomplete message */
  onRetry: () => void;
  /** Callback when clicking a suggestion */
  onSuggestionClick: (text: string) => void;
  /** Callback to navigate to transcripts */
  onNavigateToTranscripts: () => void;
}

// ==================== Component ====================

/**
 * ChatMessageList component
 * 
 * Renders the list of chat messages with:
 * - Welcome state when no messages
 * - Loading skeleton while fetching history
 * - User and assistant messages
 * - Tool call displays
 * - Source citations
 * - Incomplete message markers
 */
export function ChatMessageList({
  messages,
  isLoadingMessages,
  isLoading,
  isChatReady,
  userName,
  hasTranscripts,
  incompleteMessageIds,
  onCallClick,
  onRetry,
  onSuggestionClick,
  onNavigateToTranscripts,
}: ChatMessageListProps): React.ReactElement {
  return (
    <ChatContainerRoot className="h-full">
      <ChatContainerContent className="px-4 py-0">
        {/* Loading skeleton while fetching chat history */}
        {isLoadingMessages && <ChatLoading />}

        {/* Welcome/Empty State */}
        {!isLoadingMessages && messages.length === 0 && (
          hasTranscripts ? (
            // Normal state - user has transcripts
            <ChatWelcome
              userName={userName}
              subtitle="Search across all your calls, find specific discussions, and uncover insights."
              onSuggestionClick={onSuggestionClick}
            />
          ) : (
            // Empty transcript database - show onboarding message
            <ChatWelcome
              userName={userName}
              greeting="Upload transcripts to start chatting"
              subtitle="Once you have meeting transcripts, you can search, analyze, and get insights from your calls."
              suggestions={[]}
              quickActions={[
                {
                  id: 'upload-transcripts',
                  label: 'Upload Transcripts',
                  icon: <RiUploadCloud2Line className="h-4 w-4" />,
                  onClick: onNavigateToTranscripts,
                },
              ]}
            />
          )
        )}

        {/* Messages */}
        {!isLoadingMessages && messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            incompleteMessageIds={incompleteMessageIds}
            onCallClick={onCallClick}
            onRetry={onRetry}
          />
        ))}

        {/* Loading indicator - only show if not already showing a tool/thinking state in last message */}
        {isLoading && (
          <LoadingIndicator messages={messages} />
        )}

        {/* Session invalid warning - only show if NOT loading */}
        {!isChatReady && !isLoading && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-yellow-700 dark:text-yellow-400">
            <p className="text-sm font-medium">Session not ready</p>
            <p className="text-xs mt-1">Please sign in to use chat features.</p>
          </div>
        )}
      </ChatContainerContent>
      <ChatContainerScrollAnchor />
      <ScrollButton className="shadow-lg" />
    </ChatContainerRoot>
  );
}

// ==================== Sub-components ====================

interface MessageItemProps {
  message: UIMessage;
  incompleteMessageIds: Set<string>;
  onCallClick: (recordingId: number) => void;
  onRetry: () => void;
}

function MessageItem({
  message,
  incompleteMessageIds,
  onCallClick,
  onRetry,
}: MessageItemProps): React.ReactElement | null {
  if (message.role === 'user') {
    const textContent = getMessageTextContent(message);
    return <UserMessage>{textContent}</UserMessage>;
  }

  if (message.role === 'assistant') {
    const toolParts = getToolInvocations(message);
    const textContent = getMessageTextContent(message);

    // Extract citation sources from tool result parts
    const citationSources = extractSourcesFromParts(
      toolParts.filter((p) => p.type === 'tool-result' && p.result)
    );
    const sourceDataList = citationSourcesToSourceData(citationSources, message.id);

    const hasContent = textContent.trim().length > 0;
    const isThinking = !hasContent && toolParts.length > 0;
    const hasCitations = citationSources.length > 0;
    const isIncomplete = incompleteMessageIds.has(message.id);

    return (
      <div className="space-y-2">
        {toolParts.length > 0 && (
          <ToolCalls parts={toolParts as ToolCallPart[]} />
        )}
        {hasContent ? (
          <div>
            <AssistantMessage
              markdown
              showSaveButton
              saveMetadata={{ source: 'chat', generated_at: new Date().toISOString() }}
              citations={hasCitations ? citationSources : undefined}
              onCitationClick={onCallClick}
              onViewCall={onCallClick}
            >
              {textContent}
            </AssistantMessage>
            {isIncomplete && (
              <IncompleteMessageWarning onRetry={onRetry} />
            )}
          </div>
        ) : isThinking ? (
          <AssistantMessage>
            <ThinkingLoader />
          </AssistantMessage>
        ) : null}
        {hasCitations && (
          <SourceList
            sources={sourceDataList}
            indices={citationSources.map((s) => s.index)}
            onSourceClick={onCallClick}
            className="ml-0"
          />
        )}
      </div>
    );
  }

  return null;
}

interface IncompleteMessageWarningProps {
  onRetry: () => void;
}

function IncompleteMessageWarning({ onRetry }: IncompleteMessageWarningProps): React.ReactElement {
  return (
    <div className="ml-11 mt-1 flex items-center gap-2">
      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Incomplete response
      </span>
      <button
        onClick={onRetry}
        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
      >
        ↻ Retry
      </button>
    </div>
  );
}

interface LoadingIndicatorProps {
  messages: UIMessage[];
}

function LoadingIndicator({ messages }: LoadingIndicatorProps): React.ReactElement | null {
  const lastMsg = messages[messages.length - 1];
  const isLastMsgThinking =
    lastMsg?.role === 'assistant' &&
    !getMessageTextContent(lastMsg).trim() &&
    getToolInvocations(lastMsg).length > 0;

  if (isLastMsgThinking) return null;

  return (
    <div className="ml-11">
      <ThinkingLoader />
    </div>
  );
}
