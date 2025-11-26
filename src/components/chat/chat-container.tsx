import * as React from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';
import { cn } from '@/lib/utils';

// Context for sharing scroll state
interface ChatContainerContextValue {
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

const ChatContainerContext = React.createContext<ChatContainerContextValue | undefined>(undefined);

export function useChatContainer() {
  const context = React.useContext(ChatContainerContext);
  if (!context) {
    throw new Error('useChatContainer must be used within a ChatContainerRoot');
  }
  return context;
}

// Root container with auto-scroll
interface ChatContainerRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatContainerRoot({ children, className, ...props }: ChatContainerRootProps) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    resize: 'smooth',
    initial: 'smooth',
  });

  return (
    <ChatContainerContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div
        ref={scrollRef}
        className={cn('relative h-full w-full overflow-y-auto', className)}
        {...props}
      >
        <div ref={contentRef} className="flex min-h-full flex-col">
          {children}
        </div>
      </div>
    </ChatContainerContext.Provider>
  );
}

// Content wrapper
interface ChatContainerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatContainerContent({ children, className, ...props }: ChatContainerContentProps) {
  return (
    <div className={cn('flex flex-1 flex-col', className)} {...props}>
      {children}
    </div>
  );
}

// Scroll anchor (optional)
type ChatContainerScrollAnchorProps = React.HTMLAttributes<HTMLDivElement>;

export function ChatContainerScrollAnchor({ className, ...props }: ChatContainerScrollAnchorProps) {
  return <div className={cn('h-px w-full', className)} {...props} />;
}

// Composed component for convenience
interface ChatContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatContainer({ children, className, ...props }: ChatContainerProps) {
  return (
    <ChatContainerRoot className={className} {...props}>
      <ChatContainerContent>{children}</ChatContainerContent>
      <ChatContainerScrollAnchor />
    </ChatContainerRoot>
  );
}
