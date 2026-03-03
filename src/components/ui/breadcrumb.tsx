import React from 'react';
import { cn } from '@/lib/utils';
import { RiArrowRightSLine } from '@remixicon/react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-xs text-muted-foreground", className)}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <RiArrowRightSLine className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
            )}
            {item.onClick || item.href ? (
              <button
                type="button"
                onClick={item.onClick}
                className={cn(
                  "hover:text-foreground transition-colors font-medium",
                  index === items.length - 1 && "text-foreground cursor-default pointer-events-none"
                )}
              >
                {item.label}
              </button>
            ) : (
              <span className={cn(
                "font-medium",
                index === items.length - 1 && "text-foreground"
              )}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
