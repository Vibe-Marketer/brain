/**
 * ChatInputArea Tests
 * 
 * Tests for the chat input component including:
 * - Input handling and submission
 * - Placeholder states (rate limited, reconnecting, not ready)
 * - Context attachments
 * - Mentions popover
 * - Model selector
 */

import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInputArea, type ChatInputAreaProps } from '../ChatInputArea';
import type { ContextAttachment } from '@/components/chat/prompt-input';
import type { ChatCall } from '@/types/chat';

// Mock prompt-input components
vi.mock('@/components/chat/prompt-input', () => ({
  PromptInput: ({ children, onSubmit, value, isLoading }: { 
    children: React.ReactNode; 
    onSubmit: () => void;
    value: string;
    isLoading?: boolean;
  }) => (
    <form 
      data-testid="prompt-input" 
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      data-value={value}
      data-loading={isLoading}
    >
      {children}
    </form>
  ),
  PromptInputTextarea: React.forwardRef<HTMLTextAreaElement, { 
    placeholder?: string; 
    disabled?: boolean;
    className?: string;
  }>(({ placeholder, disabled, className }, ref) => (
    <textarea 
      ref={ref}
      data-testid="prompt-textarea"
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )),
  PromptInputContextBar: ({ 
    attachments, 
    onRemoveAttachment,
    onAddCall,
  }: { 
    attachments: ContextAttachment[];
    onRemoveAttachment: (id: number) => void;
    availableCalls?: ChatCall[];
    onAddCall?: (call: ChatCall) => void;
  }) => (
    <div data-testid="context-bar">
      <span data-testid="attachment-count">{attachments.length}</span>
      {attachments.map((a) => (
        <button
          key={a.id}
          data-testid={`attachment-${a.id}`}
          onClick={() => onRemoveAttachment(a.id)}
        >
          {a.title}
        </button>
      ))}
      <button 
        data-testid="add-call-btn"
        onClick={() => onAddCall?.({ recording_id: 999, title: 'New Call', created_at: '2024-01-01' })}
      >
        Add Call
      </button>
    </div>
  ),
  PromptInputFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="prompt-footer">{children}</div>
  ),
  PromptInputFooterLeft: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="footer-left">{children}</div>
  ),
  PromptInputFooterRight: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="footer-right">{children}</div>
  ),
  PromptInputHintBar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hint-bar">{children}</div>
  ),
  KeyboardHint: ({ label, shortcut }: { label: string; shortcut: string }) => (
    <span data-testid="keyboard-hint">{label}: {shortcut}</span>
  ),
}));

// Mock model selector
vi.mock('@/components/chat/model-selector', () => ({
  ModelSelector: ({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) => (
    <select 
      data-testid="model-selector" 
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="gpt-4">GPT-4</option>
      <option value="gpt-3.5">GPT-3.5</option>
    </select>
  ),
}));

// Mock UI Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, type, size, className }: { 
    children: React.ReactNode; 
    disabled?: boolean;
    type?: string;
    size?: string;
    className?: string;
  }) => (
    <button 
      data-testid="submit-button"
      type={type as 'submit' | 'button' | 'reset' | undefined}
      disabled={disabled}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

// Mock Remix Icon
vi.mock('@remixicon/react', () => ({
  RiSendPlaneFill: () => <svg data-testid="send-icon" />,
  RiAtLine: () => <svg data-testid="at-icon" />,
  RiVideoLine: () => <svg data-testid="video-icon" />,
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => {
    if (formatStr === 'MMM d, yyyy') {
      return 'Jan 1, 2024';
    }
    return date.toISOString();
  },
}));

describe('ChatInputArea', () => {
  const mockTextareaRef = { current: null } as React.RefObject<HTMLTextAreaElement>;

  const defaultProps: ChatInputAreaProps = {
    input: '',
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
    isChatReady: true,
    isRateLimited: false,
    rateLimitSeconds: 0,
    isReconnecting: false,
    reconnectAttemptDisplay: 0,
    maxReconnectAttempts: 3,
    selectedModel: 'gpt-4',
    onModelChange: vi.fn(),
    contextAttachments: [],
    onRemoveAttachment: vi.fn(),
    availableCalls: [],
    onAddCall: vi.fn(),
    showMentions: false,
    filteredCalls: [],
    onMentionSelect: vi.fn(),
    textareaRef: mockTextareaRef,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render prompt input component', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('prompt-input')).toBeDefined();
    });

    it('should render textarea', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('prompt-textarea')).toBeDefined();
    });

    it('should render context bar', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('context-bar')).toBeDefined();
    });

    it('should render footer with model selector and submit', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('prompt-footer')).toBeDefined();
      expect(screen.getByTestId('model-selector')).toBeDefined();
      expect(screen.getByTestId('submit-button')).toBeDefined();
    });

    it('should render keyboard hints', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('hint-bar')).toBeDefined();
      expect(screen.getAllByTestId('keyboard-hint')).toHaveLength(2);
    });
  });

  describe('Placeholder Text', () => {
    it('should show default placeholder when ready', () => {
      render(<ChatInputArea {...defaultProps} isChatReady={true} />);
      const textarea = screen.getByTestId('prompt-textarea');
      expect(textarea.getAttribute('placeholder')).toBe('Ask about your transcripts... (type @ to mention a call)');
    });

    it('should show unavailable placeholder when not ready', () => {
      render(<ChatInputArea {...defaultProps} isChatReady={false} />);
      const textarea = screen.getByTestId('prompt-textarea');
      expect(textarea.getAttribute('placeholder')).toBe('Chat unavailable - please sign in');
    });

    it('should show rate limit placeholder when rate limited', () => {
      render(<ChatInputArea {...defaultProps} isRateLimited={true} rateLimitSeconds={30} />);
      const textarea = screen.getByTestId('prompt-textarea');
      expect(textarea.getAttribute('placeholder')).toBe('Rate limited - please wait 30s...');
    });

    it('should show reconnecting placeholder when reconnecting', () => {
      render(
        <ChatInputArea 
          {...defaultProps} 
          isReconnecting={true}
          reconnectAttemptDisplay={2}
          maxReconnectAttempts={3}
        />
      );
      const textarea = screen.getByTestId('prompt-textarea');
      expect(textarea.getAttribute('placeholder')).toBe('Reconnecting (attempt 2/3)...');
    });
  });

  describe('Button Text', () => {
    it('should show "Send" when normal state', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('submit-button').textContent).toContain('Send');
    });

    it('should show wait time when rate limited', () => {
      render(<ChatInputArea {...defaultProps} isRateLimited={true} rateLimitSeconds={45} />);
      expect(screen.getByTestId('submit-button').textContent).toContain('Wait 45s');
    });

    it('should show reconnecting when reconnecting', () => {
      render(<ChatInputArea {...defaultProps} isReconnecting={true} />);
      expect(screen.getByTestId('submit-button').textContent).toContain('Reconnecting...');
    });
  });

  describe('Disabled States', () => {
    it('should disable textarea when loading', () => {
      render(<ChatInputArea {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('prompt-textarea').hasAttribute('disabled')).toBe(true);
    });

    it('should disable textarea when not ready', () => {
      render(<ChatInputArea {...defaultProps} isChatReady={false} />);
      expect(screen.getByTestId('prompt-textarea').hasAttribute('disabled')).toBe(true);
    });

    it('should disable textarea when rate limited', () => {
      render(<ChatInputArea {...defaultProps} isRateLimited={true} />);
      expect(screen.getByTestId('prompt-textarea').hasAttribute('disabled')).toBe(true);
    });

    it('should disable textarea when reconnecting', () => {
      render(<ChatInputArea {...defaultProps} isReconnecting={true} />);
      expect(screen.getByTestId('prompt-textarea').hasAttribute('disabled')).toBe(true);
    });

    it('should disable submit button when input is empty', () => {
      render(<ChatInputArea {...defaultProps} input="" />);
      expect(screen.getByTestId('submit-button').hasAttribute('disabled')).toBe(true);
    });

    it('should disable submit button when input is only whitespace', () => {
      render(<ChatInputArea {...defaultProps} input="   " />);
      expect(screen.getByTestId('submit-button').hasAttribute('disabled')).toBe(true);
    });

    it('should enable submit button when input has content and ready', () => {
      render(<ChatInputArea {...defaultProps} input="Hello" isChatReady={true} />);
      expect(screen.getByTestId('submit-button').hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit when form is submitted', () => {
      const onSubmit = vi.fn();
      render(<ChatInputArea {...defaultProps} input="Test" onSubmit={onSubmit} />);

      fireEvent.submit(screen.getByTestId('prompt-input'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Model Selection', () => {
    it('should display selected model', () => {
      render(<ChatInputArea {...defaultProps} selectedModel="gpt-4" />);
      expect((screen.getByTestId('model-selector') as HTMLSelectElement).value).toBe('gpt-4');
    });

    it('should call onModelChange when model changed', () => {
      const onModelChange = vi.fn();
      render(<ChatInputArea {...defaultProps} onModelChange={onModelChange} />);

      fireEvent.change(screen.getByTestId('model-selector'), { target: { value: 'gpt-3.5' } });
      expect(onModelChange).toHaveBeenCalledWith('gpt-3.5');
    });
  });

  describe('Context Attachments', () => {
    it('should show attachment count', () => {
      const attachments: ContextAttachment[] = [
        { type: 'call', id: 1, title: 'Call 1', date: '2024-01-01' },
        { type: 'call', id: 2, title: 'Call 2', date: '2024-01-02' },
      ];

      render(<ChatInputArea {...defaultProps} contextAttachments={attachments} />);
      expect(screen.getByTestId('attachment-count').textContent).toBe('2');
    });

    it('should call onRemoveAttachment when attachment removed', () => {
      const onRemoveAttachment = vi.fn();
      const attachments: ContextAttachment[] = [
        { type: 'call', id: 123, title: 'Test Call', date: '2024-01-01' },
      ];

      render(
        <ChatInputArea 
          {...defaultProps} 
          contextAttachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
        />
      );

      fireEvent.click(screen.getByTestId('attachment-123'));
      expect(onRemoveAttachment).toHaveBeenCalledWith(123);
    });

    it('should call onAddCall when adding call', () => {
      const onAddCall = vi.fn();
      render(<ChatInputArea {...defaultProps} onAddCall={onAddCall} />);

      fireEvent.click(screen.getByTestId('add-call-btn'));
      expect(onAddCall).toHaveBeenCalledWith({
        recording_id: 999,
        title: 'New Call',
        created_at: '2024-01-01',
      });
    });
  });

  describe('Mentions Popover', () => {
    it('should not show mentions popover when showMentions=false', () => {
      render(<ChatInputArea {...defaultProps} showMentions={false} />);
      expect(screen.queryByText('Mention a call')).toBeNull();
    });

    it('should not show mentions popover when no filtered calls', () => {
      render(<ChatInputArea {...defaultProps} showMentions={true} filteredCalls={[]} />);
      expect(screen.queryByText('Mention a call')).toBeNull();
    });

    it('should show mentions popover when showMentions=true and has calls', () => {
      const filteredCalls: ChatCall[] = [
        { recording_id: 1, title: 'Test Call', created_at: '2024-01-01' },
      ];

      render(
        <ChatInputArea 
          {...defaultProps} 
          showMentions={true}
          filteredCalls={filteredCalls}
        />
      );

      expect(screen.getByText('Mention a call')).toBeDefined();
    });

    it('should display filtered calls in popover', () => {
      const filteredCalls: ChatCall[] = [
        { recording_id: 1, title: 'Sales Meeting', created_at: '2024-01-15' },
        { recording_id: 2, title: 'Team Standup', created_at: '2024-01-16' },
      ];

      render(
        <ChatInputArea 
          {...defaultProps} 
          showMentions={true}
          filteredCalls={filteredCalls}
        />
      );

      expect(screen.getByText('Sales Meeting')).toBeDefined();
      expect(screen.getByText('Team Standup')).toBeDefined();
    });

    it('should call onMentionSelect when call is clicked', () => {
      const onMentionSelect = vi.fn();
      const filteredCalls: ChatCall[] = [
        { recording_id: 1, title: 'Test Call', created_at: '2024-01-15' },
      ];

      render(
        <ChatInputArea 
          {...defaultProps} 
          showMentions={true}
          filteredCalls={filteredCalls}
          onMentionSelect={onMentionSelect}
        />
      );

      fireEvent.click(screen.getByText('Test Call'));
      expect(onMentionSelect).toHaveBeenCalledWith(filteredCalls[0]);
    });

    it('should show formatted date for calls', () => {
      const filteredCalls: ChatCall[] = [
        { recording_id: 1, title: 'Test Call', created_at: '2024-01-15T10:00:00Z' },
      ];

      render(
        <ChatInputArea 
          {...defaultProps} 
          showMentions={true}
          filteredCalls={filteredCalls}
        />
      );

      // Our mock formats to 'Jan 1, 2024'
      expect(screen.getByText('Jan 1, 2024')).toBeDefined();
    });
  });

  describe('Send Icon', () => {
    it('should render send icon in button', () => {
      render(<ChatInputArea {...defaultProps} />);
      expect(screen.getByTestId('send-icon')).toBeDefined();
    });
  });

  describe('Empty Calls Handling', () => {
    it('should handle empty availableCalls array', () => {
      render(<ChatInputArea {...defaultProps} availableCalls={[]} />);
      expect(screen.getByTestId('context-bar')).toBeDefined();
    });
  });
});
