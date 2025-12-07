import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Markdown } from './markdown';

// Message container
interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Message({ children, className, ...props }: MessageProps) {
  return (
    <div className={cn('group flex gap-3 py-4', className)} {...props}>
      {children}
    </div>
  );
}

// Message avatar
interface MessageAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  delayMs?: number;
  className?: string;
}

export function MessageAvatar({ src, alt, fallback, delayMs, className }: MessageAvatarProps) {
  return (
    <Avatar className={cn('h-8 w-8 shrink-0', className)}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
    </Avatar>
  );
}

// Message content
interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  markdown?: boolean;
}

export function MessageContent({ children, markdown = false, className, ...props }: MessageContentProps) {
  if (markdown && typeof children === 'string') {
    return (
      <div className={cn('flex-1 space-y-2 overflow-hidden', className)} {...props}>
        <Markdown className="prose prose-sm dark:prose-invert max-w-none font-sans font-light text-cb-ink">
          {children}
        </Markdown>
      </div>
    );
  }

  return (
    <div
      className={cn('flex-1 space-y-2 overflow-hidden font-sans font-light text-cb-ink', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Message actions (copy, regenerate, etc.)
interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function MessageActions({ children, className, ...props }: MessageActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Single message action with tooltip
interface MessageActionProps {
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function MessageAction({ tooltip, children, side = 'top', className }: MessageActionProps) {
  if (!tooltip) {
    return <span className={className}>{children}</span>;
  }

  // Note: TooltipProvider is at the app level in App.tsx, no need to wrap here
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// User message variant - iMessage blue style (exact match with Transcript Conversation View)
interface UserMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function UserMessage({ children, className }: UserMessageProps) {
  return (
    <div className={cn('flex justify-end py-3', className)}>
      <div className="max-w-[70%] flex flex-col items-end gap-1">
        <div className="rounded-[18px] rounded-br-[4px] bg-[#007AFF] dark:bg-[#0A84FF] px-4 py-2 text-white">
          <p className="text-[15px] leading-[20px]">{children}</p>
        </div>
      </div>
    </div>
  );
}

// Assistant message variant - gray bubble style (exact match with Transcript Conversation View)
interface AssistantMessageProps {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function AssistantMessage({ children, markdown = true, className, isLoading }: AssistantMessageProps) {
  return (
    <div className={cn('flex justify-start py-3', className)}>
      <div className="max-w-[70%] flex flex-col items-start gap-1">
        <div className="rounded-[18px] rounded-bl-[4px] bg-cb-hover dark:bg-cb-panel-dark px-4 py-2 text-cb-ink">
          {isLoading ? (
            <div className="flex items-center gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted" />
            </div>
          ) : markdown && typeof children === 'string' ? (
            <Markdown className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-[20px]">
              {children}
            </Markdown>
          ) : (
            <div className="text-[15px] leading-[20px]">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
