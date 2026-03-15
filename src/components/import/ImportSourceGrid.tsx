/**
 * ImportSourceGrid — Responsive grid container for import source cards.
 */

import type { ReactNode } from 'react';
import { RiTimeLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface ImportSourceGridProps {
  children: ReactNode;
}

export function ImportSourceGrid({ children }: ImportSourceGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {children}

      {/* Non-interactive "coming soon" callout — replaces the old "Add Source" button */}
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/30 p-6',
          'text-muted-foreground/60 select-none',
          'min-h-[140px]',
        )}
        aria-hidden="true"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-current">
          <RiTimeLine size={18} />
        </div>
        <span className="text-xs font-medium text-center leading-snug">
          More Sources<br />Coming Soon
        </span>
      </div>
    </div>
  );
}
