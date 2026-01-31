/**
 * Cron Expression Utilities
 *
 * Provides cron expression parsing and validation for the frontend.
 * Uses cron-parser for parsing and cronstrue for human-readable descriptions.
 */

import CronExpressionParser, { type CronExpressionOptions } from 'cron-parser';
import cronstrue from 'cronstrue';

export interface CronValidationResult {
  valid: boolean;
  error?: string;
}

export interface NextRunsResult {
  runs: Date[];
  error?: string;
}

/**
 * Validate a cron expression.
 *
 * @param expression - Standard 5-field cron expression (minute hour day-of-month month day-of-week)
 * @returns Validation result with error message if invalid
 */
export function validateCronExpression(expression: string): CronValidationResult {
  if (!expression || !expression.trim()) {
    return { valid: false, error: 'Cron expression is required' };
  }

  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);

  // Check for 5-field format
  if (fields.length !== 5) {
    return {
      valid: false,
      error: `Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`,
    };
  }

  try {
    CronExpressionParser.parse(trimmed);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid cron expression';
    return { valid: false, error: message };
  }
}

/**
 * Calculate the next N run times for a cron expression.
 *
 * @param expression - Standard 5-field cron expression
 * @param count - Number of next runs to calculate (default 3)
 * @param options - Parser options (timezone, currentDate)
 * @returns Array of next run dates or error message
 */
export function calculateNextRuns(
  expression: string,
  count: number = 3,
  options?: CronExpressionOptions
): NextRunsResult {
  const validation = validateCronExpression(expression);
  if (!validation.valid) {
    return { runs: [], error: validation.error };
  }

  try {
    const cronExpression = CronExpressionParser.parse(expression.trim(), {
      currentDate: options?.currentDate || new Date(),
      tz: options?.tz || undefined,
    });

    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      const next = cronExpression.next();
      runs.push(next.toDate());
    }

    return { runs };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate next runs';
    return { runs: [], error: message };
  }
}

/**
 * Convert a cron expression to a human-readable description.
 *
 * @param expression - Standard 5-field cron expression
 * @returns Human-readable description or error message
 */
export function getCronDescription(expression: string): string {
  const validation = validateCronExpression(expression);
  if (!validation.valid) {
    return validation.error || 'Invalid expression';
  }

  try {
    return cronstrue.toString(expression.trim(), {
      use24HourTimeFormat: false,
      throwExceptionOnParseError: true,
    });
  } catch {
    return 'Unable to describe schedule';
  }
}

/**
 * Common cron expression presets for quick selection.
 */
export const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Daily at 5pm', value: '0 17 * * *' },
  { label: 'Weekly on Monday at 9am', value: '0 9 * * 1' },
  { label: 'First day of month at 9am', value: '0 9 1 * *' },
] as const;
