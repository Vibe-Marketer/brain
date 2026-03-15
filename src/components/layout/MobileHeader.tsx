/**
 * MobileHeader — Fixed top bar for mobile viewports only (< 768px)
 *
 * Shows hamburger (opens nav drawer) + app wordmark + optional secondary panel toggle.
 * Desktop and tablet: this component is never rendered.
 *
 * @pattern mobile-header
 * @brand-version v1.0
 */

import * as React from 'react';
import { RiMenuLine, RiLayoutColumnLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

export interface MobileHeaderProps {
  /** Called when the hamburger button is tapped — opens the nav drawer */
  onOpenNav: () => void;
  /** Called when the secondary panel toggle is tapped — opens the secondary drawer */
  onOpenSecondary?: () => void;
  /** Whether to show the secondary panel toggle button */
  showSecondaryToggle?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function MobileHeader({
  onOpenNav,
  onOpenSecondary,
  showSecondaryToggle = false,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-30',
        'h-[52px] bg-card border-b border-border/60',
        'flex items-center px-4 gap-3',
        className,
      )}
    >
      {/* Hamburger — opens nav drawer */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className={cn(
          'flex-shrink-0 flex items-center justify-center',
          'w-9 h-9 rounded-lg',
          'text-muted-foreground hover:text-foreground hover:bg-muted/70',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <RiMenuLine className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* App wordmark — centered */}
      <span className="flex-1 text-center font-semibold text-foreground text-base tracking-tight select-none">
        CallVault
      </span>

      {/* Secondary panel toggle — only shown when a secondaryPane exists */}
      {showSecondaryToggle ? (
        <button
          type="button"
          onClick={onOpenSecondary}
          aria-label="Open panel"
          className={cn(
            'flex-shrink-0 flex items-center justify-center',
            'w-9 h-9 rounded-lg',
            'text-muted-foreground hover:text-foreground hover:bg-muted/70',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <RiLayoutColumnLine className="w-5 h-5" aria-hidden="true" />
        </button>
      ) : (
        /* Spacer to keep wordmark centred when no toggle */
        <span className="flex-shrink-0 w-9" aria-hidden="true" />
      )}
    </header>
  );
}
