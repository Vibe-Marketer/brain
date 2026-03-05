/**
 * ImportSourceGrid — Responsive grid container for import source cards.
 */

import type { ReactNode } from 'react';
import { RiAddLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface ImportSourceGridProps {
  children: ReactNode;
  onAddSource?: () => void;
}

export function ImportSourceGrid({ children, onAddSource }: ImportSourceGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {children}

      <button
        type="button"
        onClick={onAddSource}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 p-6',
          'text-muted-foreground cursor-pointer',
          'transition-colors hover:border-border hover:bg-muted/30 hover:text-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'min-h-[140px]',
        )}
        aria-label="Add a new import source"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-current">
          <RiAddLine size={18} aria-hidden="true" />
        </div>
        <span className="text-xs font-medium">Add Source</span>
      </button>
    </div>
  );
}
