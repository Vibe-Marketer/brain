import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { RiArrowLeftLine } from '@remixicon/react';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
  onBack?: () => void;
  showBackButton?: boolean;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader - Unified header component for all main content panes
 * 
 * Provides consistent typography, spacing, and layout for page titles,
 * subtitles, navigation, and actions.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  onBack,
  showBackButton = false,
  actions,
  breadcrumbs,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn(
      "flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0 min-h-[56px]",
      className
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {showBackButton && onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mr-1 -ml-1 h-8 w-8 p-0"
            aria-label="Go back"
          >
            <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />}

        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb items={breadcrumbs} className="mb-0.5" />
          )}
          <h2 className="font-display font-extrabold text-sm uppercase tracking-wide truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate font-normal">
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
