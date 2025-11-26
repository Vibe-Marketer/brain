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
          'relative flex w-full flex-col rounded-2xl border border-cb-border bg-card shadow-sm',
          'transition-all duration-200',
          'focus-within:border-vibe-green focus-within:ring-2 focus-within:ring-vibe-green/20 focus-within:shadow-md',
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
        'text-sm text-cb-ink placeholder:text-cb-ink-muted',
        'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
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
