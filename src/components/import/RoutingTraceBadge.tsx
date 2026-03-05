/**
 * RoutingTraceBadge — Displays "Routed by: [Rule Name]" on call rows that were auto-routed.
 */

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

interface RoutingTraceBadgeProps {
  sourceMetadata: Record<string, unknown> | null | undefined;
}

function formatRoutedAt(routedAt: string): string {
  try {
    return new Date(routedAt).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return routedAt;
  }
}

export function RoutingTraceBadge({ sourceMetadata }: RoutingTraceBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!sourceMetadata) return null;

  const ruleName = sourceMetadata['routed_by_rule_name'];
  const routedAt = sourceMetadata['routed_at'];

  if (!ruleName || typeof ruleName !== 'string') return null;

  const routedAtStr = typeof routedAt === 'string' ? routedAt : null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5',
            'bg-muted text-muted-foreground',
            'text-[11px] font-medium',
            'cursor-pointer hover:bg-muted/80 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'shrink-0',
          )}
          aria-label={`Routed by rule: ${ruleName}`}
        >
          Routed by: {ruleName}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'z-50 w-64 rounded-xl border border-border bg-popover shadow-lg p-3',
            'animate-in fade-in-0 zoom-in-95 duration-200',
          )}
        >
          <p className="text-sm font-semibold text-foreground mb-1">
            Rule: {ruleName}
          </p>
          {routedAtStr && (
            <p className="text-sm text-muted-foreground">
              When: {formatRoutedAt(routedAtStr)}
            </p>
          )}
          {!routedAtStr && (
            <p className="text-sm text-muted-foreground">
              Automatically routed on import
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
