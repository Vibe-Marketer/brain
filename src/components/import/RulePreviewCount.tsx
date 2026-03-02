/**
 * RulePreviewCount — Live match count badge with expandable call list and warnings.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RiAlertLine, RiInformationLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

const SOURCE_LABELS: Record<string, string> = {
  fathom: 'Fathom',
  zoom: 'Zoom',
  youtube: 'YouTube',
  'file-upload': 'File Upload',
};

interface RulePreviewCountProps {
  matchingCount: number;
  matchingCalls: Array<{ id: string; title: string; source_app: string | null }>;
  totalChecked: number;
  overlapInfo: {
    hasOverlap: boolean;
    overlappingRules: Array<{ ruleName: string; matchCount: number }>;
  };
  isLoading?: boolean;
}

export function RulePreviewCount({
  matchingCount,
  matchingCalls,
  totalChecked,
  overlapInfo,
  isLoading = false,
}: RulePreviewCountProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading preview…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
        <p className="text-sm text-foreground">
          This rule would match{' '}
          <span className="font-semibold text-brand-600">{matchingCount}</span>{' '}
          of your last {totalChecked} calls
        </p>

        {matchingCount > 0 && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1 text-xs text-brand-600',
                'hover:text-brand-700 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
              )}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  <RiArrowUpSLine className="h-3.5 w-3.5" />
                  Hide matching calls
                </>
              ) : (
                <>
                  <RiArrowDownSLine className="h-3.5 w-3.5" />
                  See matching calls
                </>
              )}
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key="call-list"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="overflow-hidden"
                >
                  <ul className="mt-2 space-y-1">
                    {matchingCalls.map((call) => (
                      <li
                        key={call.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        {call.source_app && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 bg-muted text-muted-foreground font-medium">
                            {SOURCE_LABELS[call.source_app] ?? call.source_app}
                          </span>
                        )}
                        <span className="text-foreground truncate">{call.title}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {matchingCount === 0 && totalChecked > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
          <RiAlertLine className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This rule didn&apos;t match any of your last {totalChecked} calls. It may match future imports.
          </p>
        </div>
      )}

      {overlapInfo.hasOverlap && overlapInfo.overlappingRules.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-400/30 bg-blue-50 dark:bg-blue-950/20 px-3 py-2.5">
          <RiInformationLine className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Heads up: Rule &ldquo;{overlapInfo.overlappingRules[0].ruleName}&rdquo; also matches{' '}
            {overlapInfo.overlappingRules[0].matchCount} of these calls and has higher priority. It will run first.
          </p>
        </div>
      )}
    </div>
  );
}
