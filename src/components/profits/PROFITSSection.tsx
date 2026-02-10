/**
 * PROFITSSection - Display a single PROFITS section with its findings
 *
 * Features:
 * - Collapsible section with letter badge
 * - Each finding shows summary + clickable quote
 * - Quote click emits onCitationClick for transcript navigation
 *
 * @brand-version v4.2
 */

import * as React from 'react';
import { RiArrowDownSLine, RiDoubleQuotesL } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { PROFITSSection as PROFITSSectionType, PROFITSCitation } from '@/hooks/usePROFITS';

// Letter badge colors (subtle, professional)
const LETTER_COLORS: Record<string, string> = {
  P: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  R: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  O: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  F: 'bg-info-bg text-info-text',
  I: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  T: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  S: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export interface PROFITSSectionProps {
  /** The section data */
  section: PROFITSSectionType;
  /** Callback when a citation is clicked */
  onCitationClick?: (citation: PROFITSCitation) => void;
  /** Whether the section is initially expanded */
  defaultExpanded?: boolean;
}

export function PROFITSSection({
  section,
  onCitationClick,
  defaultExpanded = true,
}: PROFITSSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const hasFindings = section.findings.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'hover:bg-muted/50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-vibe-orange/50 focus:ring-inset'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Letter badge */}
          <span
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'font-display font-extrabold text-sm',
              LETTER_COLORS[section.letter]
            )}
          >
            {section.letter}
          </span>

          {/* Title */}
          <span className="font-inter font-medium text-ink">
            {section.title}
          </span>

          {/* Count badge */}
          <span className="text-xs text-ink-muted bg-muted px-2 py-0.5 rounded-full">
            {section.findings.length}
          </span>
        </div>

        {/* Expand/Collapse indicator */}
        <RiArrowDownSLine
          className={cn(
            'w-5 h-5 text-ink-muted transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Findings - Collapsible */}
      {isExpanded && (
        <div className="border-t border-border">
          {hasFindings ? (
            <div className="divide-y divide-border/50">
              {section.findings.map((finding, index) => (
                <div key={index} className="px-4 py-3">
                  {/* Summary */}
                  <p className="font-inter text-sm text-ink mb-2">
                    {finding.text}
                  </p>

                  {/* Quote - Clickable */}
                  <button
                    onClick={() => onCitationClick?.(finding.citation)}
                    className={cn(
                      'w-full text-left group',
                      'flex items-start gap-2 p-2 -mx-2 rounded-md',
                      'bg-muted/30 hover:bg-muted/50 transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-vibe-orange/50'
                    )}
                    title="Click to view in transcript"
                  >
                    <RiDoubleQuotesL className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
                    <span className="font-inter text-sm text-ink-soft italic">
                      "{finding.quote}"
                    </span>
                  </button>

                  {/* Confidence indicator (subtle) */}
                  {finding.confidence > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-vibe-orange/60 rounded-full"
                          style={{ width: `${finding.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-ink-muted">
                        {Math.round(finding.confidence * 100)}% confidence
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-ink-muted">
                No {section.title.toLowerCase()} points found in this call
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
