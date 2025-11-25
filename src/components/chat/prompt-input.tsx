import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
          'relative flex w-full flex-col rounded-xl border border-cb-border-primary bg-card',
          'focus-within:border-cb-border-focus focus-within:ring-1 focus-within:ring-cb-border-focus',
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

export function PromptInputTextarea({
  className,
  disableAutosize = false,
  onKeyDown,
  ...props
}: PromptInputTextareaProps) {
  const { value, onValueChange, isLoading, maxHeight, onSubmit } = usePromptInputContext();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
        'w-full resize-none bg-transparent px-4 py-3',
        'text-sm text-cb-ink-primary placeholder:text-cb-ink-muted',
        'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        'font-inter font-light',
        className
      )}
      style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      {...props}
    />
  );
}

// Actions container
interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputActions({ children, className, ...props }: PromptInputActionsProps) {
  return (
    <div className={cn('flex items-center gap-1 border-t border-cb-border-subtle px-2 py-2', className)} {...props}>
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
