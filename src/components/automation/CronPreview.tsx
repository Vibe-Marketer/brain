/**
 * CronPreview - Shows next scheduled run times for a cron expression
 *
 * Displays:
 * - Human-readable description of the schedule
 * - Next 3 upcoming run times
 * - Validation error if expression is invalid
 *
 * @brand-version v4.2
 */

import { useMemo } from 'react';
import { RiTimeLine, RiAlertLine, RiCalendarLine } from '@remixicon/react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  validateCronExpression,
  calculateNextRuns,
  getCronDescription,
} from '@/lib/cron-utils';

export interface CronPreviewProps {
  /** Cron expression to preview (5-field format) */
  expression: string;
  /** Optional timezone for calculations */
  timezone?: string;
  /** Optional className for the container */
  className?: string;
}

/**
 * CronPreview component shows next scheduled times for a cron expression.
 *
 * Usage:
 * ```tsx
 * <CronPreview expression="0 9 * * *" />
 * // Shows: "At 09:00 AM" with next 3 run times
 * ```
 */
export function CronPreview({ expression, timezone, className }: CronPreviewProps) {
  // Validate and calculate next runs
  const { isValid, error, description, nextRuns } = useMemo(() => {
    const validation = validateCronExpression(expression);

    if (!validation.valid) {
      return {
        isValid: false,
        error: validation.error,
        description: '',
        nextRuns: [] as Date[],
      };
    }

    const desc = getCronDescription(expression);
    const result = calculateNextRuns(expression, 3, {
      tz: timezone,
    });

    return {
      isValid: true,
      error: result.error,
      description: desc,
      nextRuns: result.runs,
    };
  }, [expression, timezone]);

  // Empty state - no expression
  if (!expression || !expression.trim()) {
    return (
      <div className={cn('rounded-lg bg-muted/50 p-4', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RiCalendarLine className="h-4 w-4" />
          <p className="text-sm">Enter a cron expression to see the schedule</p>
        </div>
      </div>
    );
  }

  // Error state - invalid expression
  if (!isValid || error) {
    return (
      <div className={cn('rounded-lg bg-destructive/10 p-4', className)}>
        <div className="flex items-start gap-2">
          <RiAlertLine className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Invalid cron expression</p>
            <p className="text-xs text-destructive/80 break-words">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state - show schedule
  return (
    <div className={cn('rounded-lg bg-muted/50 p-4 space-y-3', className)}>
      {/* Human-readable description */}
      <div className="flex items-center gap-2">
        <RiCalendarLine className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm font-medium text-foreground">{description}</p>
      </div>

      {/* Next run times */}
      {nextRuns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Next scheduled runs
          </p>
          <ul className="space-y-1.5">
            {nextRuns.map((date, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-foreground/80">
                <RiTimeLine className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{format(date, 'PPpp')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CronPreview;
