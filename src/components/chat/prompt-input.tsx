import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RiAddLine, RiVideoLine, RiCloseLine, RiSearchLine } from '@remixicon/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

// Context for prompt input state
interface PromptInputContextValue {
  value: string;
  onValueChange: (value: string) => void;
  isLoading: boolean;
  maxHeight: number | string;
  onSubmit?: () => void;
}

const PromptInputContext = React.createContext<PromptInputContextValue | undefined>(undefined);

function usePromptInputContext() {
  const context = React.useContext(PromptInputContext);
  if (!context) {
    throw new Error('PromptInput components must be used within a PromptInput');
  }
  return context;
}

// Main container
interface PromptInputProps extends Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  isLoading?: boolean;
  maxHeight?: number | string;
  onSubmit?: () => void;
}

export function PromptInput({
  children,
  value: controlledValue,
  onValueChange,
  isLoading = false,
  maxHeight = 240,
  onSubmit,
  className,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = React.useState('');
  const value = controlledValue ?? internalValue;
  const handleValueChange = onValueChange ?? setInternalValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value && value.trim() && !isLoading && onSubmit) {
      onSubmit();
    }
  };

  // Memoize context value to prevent unnecessary re-renders of children
  const contextValue = React.useMemo(
    () => ({ value, onValueChange: handleValueChange, isLoading, maxHeight, onSubmit }),
    [value, handleValueChange, isLoading, maxHeight, onSubmit]
  );

  return (
    <PromptInputContext.Provider value={contextValue}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          'relative flex w-full flex-col rounded-2xl border border-cb-border bg-card shadow-sm',
          'transition-all duration-200',
          'focus-within:border-cb-ink-muted focus-within:shadow-md',
          className
        )}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
}

// Textarea component
interface PromptInputTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  disableAutosize?: boolean;
}

export const PromptInputTextarea = React.forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(({
  className,
  disableAutosize = false,
  onKeyDown,
  ...props
}, forwardedRef) => {
  const { value, onValueChange, isLoading, maxHeight, onSubmit } = usePromptInputContext();
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRef = forwardedRef as React.RefObject<HTMLTextAreaElement> || internalRef;

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = typeof textareaRef === 'object' && textareaRef?.current ? textareaRef.current : null;
    if (disableAutosize || !textarea) return;

    textarea.style.height = 'auto';
    const maxHeightPx = typeof maxHeight === 'number' ? maxHeight : parseInt(maxHeight, 10);
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
  }, [value, maxHeight, disableAutosize, textareaRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value && value.trim() && !isLoading && onSubmit) {
        onSubmit();
      }
    }
    onKeyDown?.(e);
  };

  return (
    <textarea
      ref={textareaRef}
      id="chat-message-input"
      name="chat-message"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={isLoading}
      rows={1}
      className={cn(
        'w-full resize-none bg-transparent px-5 py-4 min-h-[52px]',
        'border-0 outline-none ring-0',
        'text-sm text-ink placeholder:text-ink-muted',
        'focus:outline-none focus:ring-0 focus:border-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'font-sans font-light',
        'transition-colors duration-150',
        className
      )}
      style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      {...props}
    />
  );
});

PromptInputTextarea.displayName = 'PromptInputTextarea';

// Actions container - wraps children with TooltipProvider for efficient tooltip rendering
interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputActions({ children, className, ...props }: PromptInputActionsProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-1 border-t border-cb-border-soft/50 px-3 py-2',
          '[&_button]:transition-all [&_button]:duration-150',
          '[&_button:hover]:scale-105',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TooltipProvider>
  );
}

// Single action with tooltip
// Note: For best performance, wrap multiple PromptInputAction components with a single TooltipProvider
interface PromptInputActionProps {
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
  className?: string;
}

export function PromptInputAction({
  tooltip,
  children,
  side = 'top',
  disabled = false,
  className,
}: PromptInputActionProps) {
  if (!tooltip) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild disabled={disabled}>
        <span className={className}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Kortex-Style Components
// ============================================================================

// Types for context attachments
export interface ContextAttachment {
  type: 'call';
  id: number;
  title: string;
  date?: string;
}

// Context bar for adding attachments/context at the top of input
interface PromptInputContextBarProps extends React.HTMLAttributes<HTMLDivElement> {
  attachments?: ContextAttachment[];
  onRemoveAttachment?: (id: number) => void;
  availableCalls?: Array<{ recording_id: number; title: string; created_at: string }>;
  onAddCall?: (call: { recording_id: number; title: string; created_at: string }) => void;
  children?: React.ReactNode;
}

export function PromptInputContextBar({
  attachments = [],
  onRemoveAttachment,
  availableCalls = [],
  onAddCall,
  children,
  className,
  ...props
}: PromptInputContextBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter calls based on search query
  const filteredCalls = React.useMemo(() => {
    // Defensive guard: ensure availableCalls is a valid array
    if (!availableCalls || !Array.isArray(availableCalls)) return [];
    if (!searchQuery) return availableCalls.slice(0, 20);
    const query = searchQuery.toLowerCase();
    return availableCalls
      .filter(call => call?.title?.toLowerCase().includes(query))
      .slice(0, 20);
  }, [availableCalls, searchQuery]);

  // Check if a call is already attached - memoized to prevent unnecessary re-renders
  const isAttached = React.useCallback((recordingId: number) => {
    return attachments.some(a => a.type === 'call' && a.id === recordingId);
  }, [attachments]);

  // Handle call selection - memoized for stability
  const handleSelectCall = React.useCallback((call: { recording_id: number; title: string; created_at: string }) => {
    // Check inline to avoid stale closure with isAttached
    const alreadyAttached = attachments.some(a => a.type === 'call' && a.id === call.recording_id);
    if (!alreadyAttached) {
      onAddCall?.(call);
    }
    setIsOpen(false);
    setSearchQuery('');
  }, [attachments, onAddCall]);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 px-3 pt-2 pb-1 min-h-[28px]',
        className
      )}
      {...props}
    >
      {/* Attached items as pills */}
      {attachments.map((attachment) => (
        <ContextAttachmentPill
          key={`${attachment.type}-${attachment.id}`}
          attachment={attachment}
          onRemove={() => onRemoveAttachment?.(attachment.id)}
        />
      ))}

      {/* Add context button with popover */}
      {children ?? (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="add-context-button"
              className={cn(
                'group flex items-center gap-1 px-2 py-1 rounded-xl',
                'border border-cb-border-soft/50 bg-transparent',
                'hover:bg-cb-hover hover:border-cb-border',
                'transition-all duration-150 cursor-pointer select-none'
              )}
            >
              <RiAddLine className="h-3.5 w-3.5 text-ink-muted group-hover:text-ink transition-colors" />
              <span className="text-xs text-ink-muted group-hover:text-ink transition-colors">
                Add context
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-80 p-0"
          >
            <div className="p-3 border-b border-cb-border">
              <div className="relative">
                <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                <input
                  type="text"
                  id="context-search-input"
                  name="context-search"
                  placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full pl-8 pr-3 py-2 rounded-lg',
                    'border border-cb-border bg-card',
                    'text-sm text-ink placeholder:text-ink-muted',
                    'focus:outline-none focus:ring-2 focus:ring-vibe-orange/50 focus:border-transparent',
                    'transition-all duration-150'
                  )}
                  autoFocus
                />
              </div>
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-2">
                {filteredCalls.length > 0 ? (
                  <div className="space-y-1">
                    {filteredCalls.map((call) => {
                      const attached = isAttached(call.recording_id);
                      return (
                        <button
                          key={call.recording_id}
                          type="button"
                          onClick={() => handleSelectCall(call)}
                          disabled={attached}
                          className={cn(
                            'w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                            attached
                              ? 'opacity-50 cursor-not-allowed bg-cb-hover'
                              : 'hover:bg-cb-hover cursor-pointer'
                          )}
                        >
                          <RiVideoLine className="h-4 w-4 text-ink-muted flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink truncate font-medium">
                              {call.title}
                            </p>
                            <p className="text-xs text-ink-muted">
                              {format(new Date(call.created_at), 'MMM d, yyyy')}
                              {attached && ' • Already added'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-sm text-ink-muted">
                      {searchQuery ? 'No calls found' : 'No calls available'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Pill component for attached context items
interface ContextAttachmentPillProps {
  attachment: ContextAttachment;
  onRemove?: () => void;
}

function ContextAttachmentPill({ attachment, onRemove }: ContextAttachmentPillProps) {
  return (
    <div
      data-testid="context-attachment-pill"
      data-recording-id={attachment.id}
      className={cn(
        'group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full',
        'bg-cb-hover border border-cb-border',
        'text-xs text-ink',
        'transition-all duration-150'
      )}
    >
      <RiVideoLine className="h-3 w-3 text-ink-muted flex-shrink-0" />
      <span className="max-w-[150px] truncate font-medium">{attachment.title}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          data-testid="remove-context-attachment"
          className={cn(
            'h-4 w-4 flex items-center justify-center rounded-full',
            'text-ink-muted hover:text-ink hover:bg-cb-border',
            'transition-colors duration-150'
          )}
          aria-label={`Remove ${attachment.title}`}
        >
          <RiCloseLine className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Footer with left/right sections (model selector on left, submit on right)
interface PromptInputFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputFooter({ children, className, ...props }: PromptInputFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-2 h-[44px]',
        'border-t border-cb-border-soft/30',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Left section of footer (for model selector, toggles)
interface PromptInputFooterLeftProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputFooterLeft({ children, className, ...props }: PromptInputFooterLeftProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} {...props}>
      {children}
    </div>
  );
}

// Right section of footer (for submit button)
interface PromptInputFooterRightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputFooterRight({ children, className, ...props }: PromptInputFooterRightProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  );
}

// Keyboard hint bar (shown below the main input container)
interface PromptInputHintBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function PromptInputHintBar({ children, className, ...props }: PromptInputHintBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between w-full',
        'text-[11px] text-ink-muted select-none',
        'pt-1.5 px-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Keyboard shortcut display component
interface KeyboardHintProps {
  label: string;
  shortcut: string;
  className?: string;
}

export function KeyboardHint({ label, shortcut, className }: KeyboardHintProps) {
  return (
    <span className={cn('flex items-center gap-1', className)}>
      <span>{label}</span>
      <kbd className="px-1.5 py-0.5 text-[9px] bg-cb-hover rounded-md border border-cb-border-soft font-mono">
        {shortcut}
      </kbd>
    </span>
  );
}
