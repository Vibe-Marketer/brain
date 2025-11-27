import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * ChatMainCard - Premium Card Container (Kortex-inspired)
 *
 * This is the main content card for the chat interface following the
 * Conversion Brain brand guidelines while incorporating Kortex design patterns.
 *
 * Structure:
 * - Card wrapper with rounded corners, subtle shadow, and border
 * - Flexible content area for chat messages or welcome state
 * - Bottom-fixed input area
 */

// ============================================================================
// ChatMainCard - The outer card wrapper
// ============================================================================

interface ChatMainCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatMainCard({ children, className, ...props }: ChatMainCardProps) {
  return (
    <div
      className={cn(
        // Kortex-style card with rounded corners and shadow
        'relative flex flex-col h-full w-full',
        'bg-card rounded-2xl',
        'border border-cb-border dark:border-cb-border-dark',
        'shadow-lg',
        // Smooth transitions on hover (subtle effect)
        'transition-shadow duration-200',
        'hover:shadow-xl',
        // Overflow handling
        'overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// ChatMainCardContent - Scrollable content area
// ============================================================================

interface ChatMainCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatMainCardContent({ children, className, ...props }: ChatMainCardContentProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto',
        // Padding for content breathing room
        'px-4 md:px-8 py-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// ChatMainCardInputArea - Bottom-fixed input section
// ============================================================================

interface ChatMainCardInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatMainCardInputArea({ children, className, ...props }: ChatMainCardInputAreaProps) {
  return (
    <div
      className={cn(
        // Fixed at bottom with border separator
        'flex-shrink-0',
        'border-t border-cb-border dark:border-cb-border-dark',
        'bg-card',
        // Padding and max-width for centered input
        'px-4 py-4',
        className
      )}
      {...props}
    >
      {/* Centered container for input - Kortex style max-width */}
      <div className="w-full max-w-[800px] mx-auto">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// ChatMainCardHeader - Optional header section for title/filters
// ============================================================================

interface ChatMainCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChatMainCardHeader({ children, className, ...props }: ChatMainCardHeaderProps) {
  return (
    <div
      className={cn(
        'flex-shrink-0',
        'px-4 md:px-6 py-3',
        'border-b border-cb-border dark:border-cb-border-dark',
        'bg-card',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
