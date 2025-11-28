import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Chat Card System - Two-Card Layout (per new-chat-design-guidelines.md)
 *
 * This implements the "Two-Card System" from the design guidelines:
 * - BG-CARD-MAIN (ChatOuterCard): The "browser window" - outermost container
 * - BG-CARD-INNER (ChatInnerCard): The "website content" - chat interface
 *
 * Both cards use IDENTICAL styling (bg-card, rounded-2xl, shadow-lg, border).
 * The only difference is their navigation pattern:
 * - BG-CARD-MAIN has NO navigation (just contains sidebar + inner card)
 * - BG-CARD-INNER has header with title + action buttons
 */

// ============================================================================
// ChatOuterCard (BG-CARD-MAIN) - The "browser window" container
// ============================================================================

interface ChatOuterCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * BG-CARD-MAIN: The outermost application container.
 * Contains a flex layout with sidebar + inner card (NO header, NO wrapper).
 *
 * Styling: bg-card rounded-2xl shadow-lg border border-border overflow-hidden h-full
 * NOTE: Edge-to-edge design - no padding, content flush with container
 */
export function ChatOuterCard({ children, className, ...props }: ChatOuterCardProps) {
  return (
    <div
      className={cn(
        // BG-CARD-MAIN styling - edge-to-edge, no internal padding
        'bg-card rounded-2xl shadow-lg',
        'border border-border',
        'overflow-hidden h-full',
        className
      )}
      data-component="BG-CARD-MAIN"
      {...props}
    >
      {/* Direct child is flex container with sidebar + inner card - no padding */}
      <div className="flex gap-2 h-full">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// ChatInnerCard (BG-CARD-INNER) - The chat interface container
// ============================================================================

interface ChatInnerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * BG-CARD-INNER: The nested card containing the actual chat interface.
 * Contains: Header → Messages → Input (vertical flex layout)
 *
 * Styling: flex-1 bg-card rounded-2xl shadow-lg border border-border overflow-hidden flex flex-col
 */
export function ChatInnerCard({ children, className, ...props }: ChatInnerCardProps) {
  return (
    <div
      className={cn(
        // BG-CARD-INNER styling (IDENTICAL to BG-CARD-MAIN except flex-1 and flex-col)
        'flex-1 bg-card rounded-2xl shadow-lg',
        'border border-border',
        'overflow-hidden flex flex-col',
        className
      )}
      data-component="BG-CARD-INNER"
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// LEGACY: ChatMainCard - kept for backwards compatibility (use ChatInnerCard)
// ============================================================================

interface ChatMainCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * @deprecated Use ChatOuterCard + ChatInnerCard instead for proper two-card system
 */
export function ChatMainCard({ children, className, ...props }: ChatMainCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col h-full w-full',
        'bg-card rounded-2xl',
        'border border-border',
        'shadow-lg',
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
// ChatInnerCardContent - Scrollable content area (inside BG-CARD-INNER)
// ============================================================================

interface ChatInnerCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Content area inside BG-CARD-INNER.
 * Padding: px-6 py-4 (per guidelines)
 */
export function ChatInnerCardContent({ children, className, ...props }: ChatInnerCardContentProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Legacy alias
export const ChatMainCardContent = ChatInnerCardContent;

// ============================================================================
// ChatInnerCardInputArea - Bottom-fixed input section (inside BG-CARD-INNER)
// ============================================================================

interface ChatInnerCardInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Input area inside BG-CARD-INNER, fixed at bottom.
 * Padding: py-1 (minimal - flush design, full width)
 * NO max-width constraint - fills the card width
 */
export function ChatInnerCardInputArea({ children, className, ...props }: ChatInnerCardInputAreaProps) {
  return (
    <div
      className={cn(
        // Fixed at bottom (no border separator for cleaner look)
        'flex-shrink-0',
        'bg-card',
        // Minimal padding: py-1 only (full width)
        'py-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Legacy alias
export const ChatMainCardInputArea = ChatInnerCardInputArea;

// ============================================================================
// ChatInnerCardHeader - Header section inside BG-CARD-INNER
// ============================================================================

interface ChatInnerCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Header inside BG-CARD-INNER with title + action buttons.
 * Padding: px-2 py-1 (minimal - flush design)
 */
export function ChatInnerCardHeader({ children, className, ...props }: ChatInnerCardHeaderProps) {
  return (
    <div
      className={cn(
        'flex-shrink-0',
        // Minimal padding: px-2 py-1 (flush design)
        'px-2 py-1',
        'bg-card',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Legacy alias
export const ChatMainCardHeader = ChatInnerCardHeader;
