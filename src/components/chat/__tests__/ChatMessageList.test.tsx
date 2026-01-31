/**
 * ChatMessageList Tests
 * 
 * Tests for the message list component including:
 * - User and assistant message rendering
 * - Tool call display
 * - Empty/welcome states
 * - Loading states
 * - Incomplete message warnings
 */

import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessageList, type ChatMessageListProps } from '../ChatMessageList';

// Mock child components
vi.mock('@/components/chat/message', () => ({
  UserMessage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="user-message">{children}</div>
  ),
  AssistantMessage: ({ children, markdown }: { children: React.ReactNode; markdown?: boolean }) => (
    <div data-testid="assistant-message" data-markdown={markdown}>
      {children}
    </div>
  ),
  extractSourcesFromParts: vi.fn(() => []),
  citationSourcesToSourceData: vi.fn(() => []),
}));

vi.mock('@/components/chat/loader', () => ({
  ThinkingLoader: () => <div data-testid="thinking-loader">Thinking...</div>,
}));

vi.mock('@/components/chat/source', () => ({
  SourceList: ({ sources }: { sources: unknown[] }) => (
    <div data-testid="source-list">Sources: {sources.length}</div>
  ),
}));

vi.mock('@/components/chat/tool-call', () => ({
  ToolCalls: ({ parts }: { parts: unknown[] }) => (
    <div data-testid="tool-calls">Tool calls: {parts.length}</div>
  ),
}));

vi.mock('@/components/chat/chat-skeleton', () => ({
  ChatLoading: () => <div data-testid="chat-loading">Loading...</div>,
}));

vi.mock('@/components/chat/chat-welcome', () => ({
  ChatWelcome: ({ userName, greeting, onSuggestionClick }: { 
    userName?: string; 
    greeting?: string;
    onSuggestionClick?: (text: string) => void;
  }) => (
    <div data-testid="chat-welcome">
      <span data-testid="welcome-user">{userName}</span>
      <span data-testid="welcome-greeting">{greeting}</span>
      <button 
        data-testid="suggestion-btn"
        onClick={() => onSuggestionClick?.('test suggestion')}
      >
        Suggestion
      </button>
    </div>
  ),
}));

vi.mock('@/components/chat/chat-container', () => ({
  ChatContainerRoot: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="chat-container-root" className={className}>{children}</div>
  ),
  ChatContainerContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="chat-container-content" className={className}>{children}</div>
  ),
  ChatContainerScrollAnchor: () => <div data-testid="scroll-anchor" />,
}));

vi.mock('@/components/chat/scroll-button', () => ({
  ScrollButton: ({ className }: { className?: string }) => (
    <button data-testid="scroll-button" className={className}>Scroll</button>
  ),
}));

// Mock Remix Icon
vi.mock('@remixicon/react', () => ({
  RiUploadCloud2Line: () => <svg data-testid="upload-icon" />,
}));

// Mock types/chat helpers
vi.mock('@/types/chat', () => ({
  getMessageTextContent: (message: { parts?: Array<{ type: string; text?: string }> }) => {
    if (!message?.parts) return '';
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p?.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
  },
  getToolInvocations: (message: { parts?: Array<{ type: string }> }) => {
    if (!message?.parts) return [];
    return message.parts.filter((p) => p?.type?.startsWith('tool-')) || [];
  },
}));

// Create mock message type that matches what ChatMessageList expects
interface MockUIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{ type: string; text?: string; toolCallId?: string; state?: string }>;
}

describe('ChatMessageList', () => {
  const defaultProps: ChatMessageListProps = {
    messages: [],
    isLoadingMessages: false,
    isLoading: false,
    isChatReady: true,
    userName: 'Test User',
    hasTranscripts: true,
    incompleteMessageIds: new Set(),
    onCallClick: vi.fn(),
    onRetry: vi.fn(),
    onSuggestionClick: vi.fn(),
    onNavigateToTranscripts: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should show loading skeleton when isLoadingMessages=true', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          isLoadingMessages={true}
        />
      );

      expect(screen.getByTestId('chat-loading')).toBeDefined();
    });

    it('should not show loading skeleton when isLoadingMessages=false', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          isLoadingMessages={false}
        />
      );

      expect(screen.queryByTestId('chat-loading')).toBeNull();
    });

    it('should show thinking loader when isLoading=true and no messages processing', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          isLoading={true}
          messages={[]}
        />
      );

      // The thinking loader appears in a specific location
      expect(screen.getByTestId('thinking-loader')).toBeDefined();
    });
  });

  describe('Welcome/Empty States', () => {
    it('should show welcome message when no messages and has transcripts', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={[]}
          hasTranscripts={true}
        />
      );

      expect(screen.getByTestId('chat-welcome')).toBeDefined();
    });

    it('should show onboarding message when no messages and no transcripts', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={[]}
          hasTranscripts={false}
        />
      );

      expect(screen.getByTestId('chat-welcome')).toBeDefined();
      // The greeting should be different for no transcripts
      expect(screen.getByTestId('welcome-greeting').textContent).toBe('Upload transcripts to start chatting');
    });

    it('should pass userName to welcome component', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={[]}
          userName="John"
        />
      );

      expect(screen.getByTestId('welcome-user').textContent).toBe('John');
    });

    it('should call onSuggestionClick when suggestion is clicked', () => {
      const onSuggestionClick = vi.fn();
      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={[]}
          onSuggestionClick={onSuggestionClick}
        />
      );

      fireEvent.click(screen.getByTestId('suggestion-btn'));
      expect(onSuggestionClick).toHaveBeenCalledWith('test suggestion');
    });

    it('should not show welcome when messages exist', () => {
      const messages = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      expect(screen.queryByTestId('chat-welcome')).toBeNull();
    });
  });

  describe('User Messages', () => {
    it('should render user message with UserMessage component', () => {
      const messages = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello world' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      expect(screen.getByTestId('user-message')).toBeDefined();
      expect(screen.getByTestId('user-message').textContent).toBe('Hello world');
    });

    it('should render multiple user messages', () => {
      const messages = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
        { id: '2', role: 'user', parts: [{ type: 'text', text: 'Second' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      const userMessages = screen.getAllByTestId('user-message');
      expect(userMessages).toHaveLength(2);
    });
  });

  describe('Assistant Messages', () => {
    it('should render assistant message with AssistantMessage component', () => {
      const messages = [
        { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      expect(screen.getByTestId('assistant-message')).toBeDefined();
      expect(screen.getByTestId('assistant-message').textContent).toContain('Hello!');
    });

    it('should render assistant message with markdown enabled', () => {
      const messages = [
        { id: '1', role: 'assistant', parts: [{ type: 'text', text: '**Bold**' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      expect(screen.getByTestId('assistant-message').getAttribute('data-markdown')).toBe('true');
    });

    it('should show thinking loader for assistant message with tool calls but no text', () => {
      const messages = [
        { 
          id: '1', 
          role: 'assistant', 
          parts: [{ type: 'tool-searchTranscripts', toolCallId: 'tc1', state: 'input-available' }] 
        },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      // Should show both ToolCalls and ThinkingLoader in AssistantMessage
      expect(screen.getByTestId('tool-calls')).toBeDefined();
      // The thinking loader appears inside AssistantMessage for thinking state
      expect(screen.getAllByTestId('thinking-loader').length).toBeGreaterThan(0);
    });
  });

  describe('Tool Calls', () => {
    it('should render tool calls when present', () => {
      const messages = [
        { 
          id: '1', 
          role: 'assistant', 
          parts: [
            { type: 'tool-searchTranscripts', toolCallId: 'tc1', state: 'output-available' },
            { type: 'text', text: 'Result' },
          ] 
        },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      expect(screen.getByTestId('tool-calls')).toBeDefined();
    });

    it('should render multiple tool calls', () => {
      const messages = [
        { 
          id: '1', 
          role: 'assistant', 
          parts: [
            { type: 'tool-searchTranscripts', toolCallId: 'tc1' },
            { type: 'tool-getCallDetails', toolCallId: 'tc2' },
            { type: 'text', text: 'Result' },
          ] 
        },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      expect(screen.getByTestId('tool-calls').textContent).toBe('Tool calls: 2');
    });
  });

  describe('Incomplete Messages', () => {
    it('should show incomplete warning for incomplete message', () => {
      const messages = [
        { id: 'msg-1', role: 'assistant', parts: [{ type: 'text', text: 'Partial response' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
          incompleteMessageIds={new Set(['msg-1'])}
        />
      );

      expect(screen.getByText('Incomplete response')).toBeDefined();
    });

    it('should show retry button for incomplete message', () => {
      const messages = [
        { id: 'msg-1', role: 'assistant', parts: [{ type: 'text', text: 'Partial' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
          incompleteMessageIds={new Set(['msg-1'])}
        />
      );

      expect(screen.getByText('↻ Retry')).toBeDefined();
    });

    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      const messages = [
        { id: 'msg-1', role: 'assistant', parts: [{ type: 'text', text: 'Partial' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
          incompleteMessageIds={new Set(['msg-1'])}
          onRetry={onRetry}
        />
      );

      fireEvent.click(screen.getByText('↻ Retry'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not show incomplete warning for complete messages', () => {
      const messages = [
        { id: 'msg-1', role: 'assistant', parts: [{ type: 'text', text: 'Complete response' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
          incompleteMessageIds={new Set()} // Empty set
        />
      );

      expect(screen.queryByText('Incomplete response')).toBeNull();
    });
  });

  describe('Session Not Ready Warning', () => {
    it('should show warning when chat is not ready and not loading', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          isChatReady={false}
          isLoading={false}
        />
      );

      expect(screen.getByText('Session not ready')).toBeDefined();
      expect(screen.getByText('Please sign in to use chat features.')).toBeDefined();
    });

    it('should not show warning when chat is ready', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          isChatReady={true}
        />
      );

      expect(screen.queryByText('Session not ready')).toBeNull();
    });

    it('should not show warning when loading', () => {
      render(
        <ChatMessageList 
          {...defaultProps} 
          isChatReady={false}
          isLoading={true}
        />
      );

      expect(screen.queryByText('Session not ready')).toBeNull();
    });
  });

  describe('Container Structure', () => {
    it('should render within ChatContainerRoot', () => {
      render(<ChatMessageList {...defaultProps} />);
      expect(screen.getByTestId('chat-container-root')).toBeDefined();
    });

    it('should render content within ChatContainerContent', () => {
      render(<ChatMessageList {...defaultProps} />);
      expect(screen.getByTestId('chat-container-content')).toBeDefined();
    });

    it('should render scroll anchor', () => {
      render(<ChatMessageList {...defaultProps} />);
      expect(screen.getByTestId('scroll-anchor')).toBeDefined();
    });

    it('should render scroll button', () => {
      render(<ChatMessageList {...defaultProps} />);
      expect(screen.getByTestId('scroll-button')).toBeDefined();
    });
  });

  describe('Mixed Message Types', () => {
    it('should render user and assistant messages in order', () => {
      const messages = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Question' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Answer' }] },
        { id: '3', role: 'user', parts: [{ type: 'text', text: 'Follow up' }] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      const userMessages = screen.getAllByTestId('user-message');
      const assistantMessages = screen.getAllByTestId('assistant-message');

      expect(userMessages).toHaveLength(2);
      expect(assistantMessages).toHaveLength(1);
    });
  });

  describe('Empty Parts Handling', () => {
    it('should handle messages with empty parts array', () => {
      const messages = [
        { id: '1', role: 'user', parts: [] },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      // Should render without crashing
      expect(screen.getByTestId('user-message')).toBeDefined();
    });

    it('should handle messages with undefined parts', () => {
      const messages = [
        { id: '1', role: 'user', parts: undefined },
      ] as unknown as ChatMessageListProps['messages'];

      render(
        <ChatMessageList 
          {...defaultProps} 
          messages={messages}
        />
      );

      // Should render without crashing
      expect(screen.getByTestId('user-message')).toBeDefined();
    });
  });
});
