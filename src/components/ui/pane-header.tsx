import React from 'react';
import { cn } from '@/lib/utils';

export interface PaneHeaderProps {
  /** Content rendered inside the 8×8 icon box (an icon element or custom node). */
  icon?: React.ReactNode;
  /** Primary heading text. Styled to the locked-in pane-heading standard. */
  title: React.ReactNode;
  /** id for the heading, so panels can wire aria-labelledby. */
  titleId?: string;
  /** Secondary line beneath the title. */
  subtitle?: React.ReactNode;
  /** Right-aligned action buttons (pin, close, etc.). */
  actions?: React.ReactNode;
  /** Inline content rendered immediately after the title (e.g. a status Badge). */
  children?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

/**
 * PaneHeader — the single, locked-in header template for every Detail (Pane 4) panel.
 *
 * Detail panels used to hand-roll their own <header>, which drifted into three
 * different title styles and two broken `py-4/40` headers. This component is the
 * one source of truth: identical height (min-h-[56px]), padding, sticky/blur
 * treatment, icon box, and typography — matching the canonical PageHeader used by
 * the main content pane (Pane 3). Panels supply icon/title/subtitle/actions only.
 */
export function PaneHeader({
  icon,
  title,
  titleId,
  subtitle,
  actions,
  children,
  className,
  titleClassName,
}: PaneHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 py-3 bg-card/50 backdrop-blur-md sticky top-0 z-10 flex-shrink-0 min-h-[56px]',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon != null && (
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border text-vibe-orange"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3
              id={titleId}
              className={cn(
                'font-display font-extrabold text-sm uppercase tracking-wide truncate',
                titleClassName
              )}
            >
              {title}
            </h3>
            {children}
          </div>
          {subtitle != null && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {actions != null && (
        <div
          className="flex items-center gap-1 flex-shrink-0"
          role="toolbar"
          aria-label="Panel actions"
        >
          {actions}
        </div>
      )}
    </header>
  );
}
