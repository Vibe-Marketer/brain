import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RiChat3Line, RiSearchLine, RiFileListLine, RiQuestionLine } from '@remixicon/react';

/**
 * ChatWelcome - Kortex-inspired welcome/empty state for chat
 *
 * Features:
 * - Personalized greeting with serif typography
 * - Quick action buttons for common tasks
 * - Suggested prompts section with hover effects
 */

// ============================================================================
// Types
// ============================================================================

interface SuggestedPrompt {
  id: string;
  text: string;
  icon?: React.ReactNode;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

// ============================================================================
// Default suggestions
// ============================================================================

const DEFAULT_SUGGESTIONS: SuggestedPrompt[] = [
  {
    id: 'sales-objections',
    text: 'What were the main objections in my recent sales calls?',
    icon: <RiChat3Line className="h-4 w-4" />,
  },
  {
    id: 'weekly-summary',
    text: 'Summarize my calls from last week',
    icon: <RiFileListLine className="h-4 w-4" />,
  },
  {
    id: 'common-topics',
    text: 'What topics came up most frequently?',
    icon: <RiSearchLine className="h-4 w-4" />,
  },
  {
    id: 'action-items',
    text: 'What action items were mentioned across my calls?',
    icon: <RiQuestionLine className="h-4 w-4" />,
  },
];

// ============================================================================
// ChatWelcome Component
// ============================================================================

interface ChatWelcomeProps {
  /** User's name for personalized greeting */
  userName?: string;
  /** Custom greeting text (overrides default) */
  greeting?: string;
  /** Subtitle text below greeting */
  subtitle?: string;
  /** Custom suggestions (uses defaults if not provided) */
  suggestions?: SuggestedPrompt[];
  /** Quick action buttons */
  quickActions?: QuickAction[];
  /** Called when a suggestion is clicked */
  onSuggestionClick?: (text: string) => void;
  /** Additional className */
  className?: string;
}

export function ChatWelcome({
  userName,
  greeting,
  subtitle = 'Ask questions about your meeting transcripts.',
  suggestions = DEFAULT_SUGGESTIONS,
  quickActions,
  onSuggestionClick,
  className,
}: ChatWelcomeProps) {
  // Generate greeting text
  const greetingText = greeting || (userName ? `Hey ${userName}, what's on your mind?` : "What's on your mind?");

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full w-full',
        'px-4 py-8 md:py-12',
        className
      )}
    >
      {/* Main content wrapper - centered and constrained */}
      <div className="w-full max-w-2xl mx-auto text-center">
        {/* Greeting - Kortex uses serif for premium feel */}
        <h1
          className={cn(
            'font-display text-2xl md:text-3xl lg:text-4xl',
            'font-extrabold uppercase tracking-wider',
            'text-cb-ink dark:text-white',
            'mb-3'
          )}
        >
          {greetingText}
        </h1>

        {/* Subtitle */}
        <p
          className={cn(
            'text-sm md:text-base',
            'font-light text-cb-ink-soft dark:text-cb-text-dark-secondary',
            'mb-8 md:mb-10'
          )}
        >
          {subtitle}
        </p>

        {/* Quick Actions (if provided) */}
        {quickActions && quickActions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-8">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className={cn(
                  'gap-2 px-4 py-2',
                  'border-cb-border dark:border-cb-border-dark',
                  'hover:border-cb-ink-muted dark:hover:border-cb-text-dark-secondary',
                  'transition-all duration-150'
                )}
              >
                {action.icon}
                <span>{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Suggested Prompts Section */}
        <div className="w-full">
          <div className="text-xs font-medium text-cb-ink-muted uppercase mb-3 tracking-wide">
            Try asking
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <SuggestedPromptItem
                key={suggestion.id}
                suggestion={suggestion}
                onClick={() => onSuggestionClick?.(suggestion.text)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SuggestedPromptItem - Individual suggestion with Kortex hover effect
// ============================================================================

interface SuggestedPromptItemProps {
  suggestion: SuggestedPrompt;
  onClick?: () => void;
}

function SuggestedPromptItem({ suggestion, onClick }: SuggestedPromptItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left',
        // Base styles
        'px-4 py-3 rounded-lg',
        'bg-transparent',
        // Border styling - left border for accent (hidden by default)
        'border-l-2 border-l-transparent',
        // Text
        'text-sm font-normal text-cb-ink-soft dark:text-cb-text-dark-secondary',
        // Kortex-style hover effect
        'transition-all duration-150 ease-out',
        'hover:bg-cb-hover dark:hover:bg-cb-border-dark',
        'hover:border-l-vibe-orange',
        'hover:text-cb-ink dark:hover:text-white',
        'hover:pl-5', // Subtle shift on hover
        // Focus
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
        // Cursor
        'cursor-pointer'
      )}
    >
      <div className="flex items-center gap-3">
        {suggestion.icon && (
          <span className="flex-shrink-0 text-cb-ink-muted transition-colors group-hover:text-cb-ink">
            {suggestion.icon}
          </span>
        )}
        <span>{suggestion.text}</span>
      </div>
    </button>
  );
}

// ============================================================================
// Exports
// ============================================================================

export type { SuggestedPrompt, QuickAction };
export { DEFAULT_SUGGESTIONS };
