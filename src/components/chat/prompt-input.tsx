import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RiAddLine } from '@remixicon/react';

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
    if (value.trim() && !isLoading && onSubmit) {
      onSubmit();
    }
  };

  return (
    <PromptInputContext.Provider value={{ value, onValueChange: handleValueChange, isLoading, maxHeight, onSubmit }}>
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
    if (disableAutosize || !textareaRef.current) return;

    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const maxHeightPx = typeof maxHeight === 'number' ? maxHeight : parseInt(maxHeight, 10);
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim() && !isLoading && onSubmit) {
        onSubmit();
      }
    }
    onKeyDown?.(e);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={isLoading}
      rows={1}
      className={cn(
        'w-full resize-none bg-transparent px-5 py-4 min-h-[52px]',
        'border-0 outline-none ring-0',
        'text-sm text-cb-ink placeholder:text-cb-ink-muted',
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

// Actions container
interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputActions({ children, className, ...props }: PromptInputActionsProps) {
  return (
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
  );
}

// Single action with tooltip
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild disabled={disabled}>
          <span className={className}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Kortex-Style Components
// ============================================================================

// Context bar for adding attachments/context at the top of input
interface PromptInputContextBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onAddContext?: () => void;
  children?: React.ReactNode;
}

export function PromptInputContextBar({
  onAddContext,
  children,
  className,
  ...props
}: PromptInputContextBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 pt-2 pb-1 min-h-[28px]',
        className
      )}
      {...props}
    >
      {children ?? (
        <button
          type="button"
          onClick={onAddContext}
          className={cn(
            'group flex items-center gap-1 px-2 py-1 rounded-xl',
            'border border-cb-border-soft/50 bg-transparent',
            'hover:bg-cb-hover hover:border-cb-border',
            'transition-all duration-150 cursor-pointer select-none'
          )}
        >
          <RiAddLine className="h-3.5 w-3.5 text-cb-ink-muted group-hover:text-cb-ink transition-colors" />
          <span className="text-xs text-cb-ink-muted group-hover:text-cb-ink transition-colors">
            Add context
          </span>
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
        'text-[11px] text-cb-ink-muted select-none',
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
