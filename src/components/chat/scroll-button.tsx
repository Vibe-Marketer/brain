import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RiArrowDownLine } from '@remixicon/react';
import { useChatContainer } from './chat-container';

interface ScrollButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  threshold?: number;
}

export function ScrollButton({ className, threshold = 50, ...props }: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useChatContainer();

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => scrollToBottom()}
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md',
        'bg-card hover:bg-cb-ink-subtle/10',
        className
      )}
      {...props}
    >
      <RiArrowDownLine className="h-4 w-4" />
      <span className="sr-only">Scroll to bottom</span>
    </Button>
  );
}
