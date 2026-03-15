/**
 * RoutingTraceBadge — Displays "Routed by: [Rule Name]" on call rows that were auto-routed.
 */

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { RiNodeTree } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';

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
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
          aria-label={`Routed by rule: ${ruleName}`}
        >
          <Badge variant="outline" className="text-[9px] md:text-2xs px-1 md:px-1.5 py-0 h-3.5 md:h-4 flex items-center gap-0.5 cursor-pointer hover:bg-muted/50 transition-colors">
            <RiNodeTree className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-muted-foreground">{ruleName}</span>
          </Badge>
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
