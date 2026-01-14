import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ChatMessageSkeletonProps {
  variant: 'user' | 'assistant';
  className?: string;
}

function ChatMessageSkeleton({ variant, className }: ChatMessageSkeletonProps) {
  if (variant === 'user') {
    return (
      <div className={cn('flex justify-end', className)}>
        <div className="max-w-[80%] space-y-2">
          <Skeleton className="h-10 w-48 rounded-2xl rounded-br-md" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', className)}>
      {/* Avatar skeleton */}
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      {/* Message content skeleton */}
      <div className="flex-1 max-w-[80%] space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

interface ChatSkeletonProps {
  messageCount?: number;
  className?: string;
}

export function ChatSkeleton({ messageCount = 3, className }: ChatSkeletonProps) {
  // Generate a pattern of user/assistant messages
  const messages = React.useMemo(() => {
    const result: Array<'user' | 'assistant'> = [];
    for (let i = 0; i < messageCount; i++) {
      // Alternate between user and assistant, starting with user
      result.push(i % 2 === 0 ? 'user' : 'assistant');
    }
    return result;
  }, [messageCount]);

  return (
    <div className={cn('space-y-6 py-4', className)}>
      {messages.map((variant, index) => (
        <ChatMessageSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
}

// Simple loading state with just a loader for initial page load
interface ChatLoadingProps {
  className?: string;
}

export function ChatLoading({ className }: ChatLoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="flex items-center gap-2 text-ink-muted">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className="text-sm font-inter font-light">Loading conversation...</span>
      </div>
    </div>
  );
}
