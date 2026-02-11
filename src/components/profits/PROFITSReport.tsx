/**
 * PROFITSReport - Full PROFITS framework report view
 *
 * Features:
 * - "Run PROFITS Analysis" button if no data
 * - Loading state during extraction
 * - All 7 sections displayed
 * - Shows extraction timestamp and model used
 *
 * @brand-version v4.2
 */

import * as React from 'react';
import {
  RiSparklingLine,
  RiRefreshLine,
  RiTimeLine,
  RiRobotLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePROFITS, type PROFITSCitation } from '@/hooks/usePROFITS';
import { PROFITSSection } from './PROFITSSection';
import { cn } from '@/lib/utils';

export interface PROFITSReportProps {
  /** Recording ID to fetch/extract PROFITS for */
  recordingId: number | undefined;
  /** Callback when a citation is clicked */
  onCitationClick?: (citation: PROFITSCitation) => void;
}

export function PROFITSReport({
  recordingId,
  onCitationClick,
}: PROFITSReportProps) {
  const { data, isLoading, isExtracting, runExtraction } = usePROFITS(recordingId);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // No data state - show extraction button
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <RiSparklingLine className="w-8 h-8 text-ink-muted" />
        </div>

        <h3 className="font-display font-extrabold text-lg uppercase tracking-wide text-ink mb-2">
          PROFITS Analysis
        </h3>

        <p className="text-sm text-ink-muted text-center max-w-md mb-6">
          Extract sales psychology insights from this call using the PROFITS
          framework: Pain, Results, Obstacles, Fears, Identity, Triggers, and
          Success.
        </p>

        <Button
          onClick={() => runExtraction(false)}
          disabled={isExtracting || !recordingId}
          className="gap-2"
        >
          {isExtracting ? (
            <>
              <RiRefreshLine className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RiSparklingLine className="w-4 h-4" />
              Run PROFITS Analysis
            </>
          )}
        </Button>
      </div>
    );
  }

  // Count total findings
  const totalFindings = data.sections.reduce(
    (sum, s) => sum + s.findings.length,
    0
  );

  return (
    <div className="space-y-4 p-4">
      {/* Header with metadata */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-display font-extrabold text-lg uppercase tracking-wide text-ink">
            PROFITS Analysis
          </h3>
          <span className="text-sm text-ink-muted">
            {totalFindings} insight{totalFindings !== 1 ? 's' : ''}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => runExtraction(true)}
          disabled={isExtracting}
          className="gap-1.5 text-ink-muted hover:text-ink"
          title="Re-run analysis"
        >
          {isExtracting ? (
            <RiRefreshLine className="w-4 h-4 animate-spin" />
          ) : (
            <RiRefreshLine className="w-4 h-4" />
          )}
          Re-analyze
        </Button>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-1">
          <RiTimeLine className="w-3.5 h-3.5" />
          <span>
            {new Date(data.generated_at).toLocaleDateString(undefined, {
              dateStyle: 'medium',
            })}{' '}
            at{' '}
            {new Date(data.generated_at).toLocaleTimeString(undefined, {
              timeStyle: 'short',
            })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <RiRobotLine className="w-3.5 h-3.5" />
          <span>{formatModelName(data.model_used)}</span>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {data.sections.map((section) => (
          <PROFITSSection
            key={section.letter}
            section={section}
            onCitationClick={onCitationClick}
            // Expand sections with findings, collapse empty ones
            defaultExpanded={section.findings.length > 0}
          />
        ))}
      </div>

      {/* Extracting overlay */}
      {isExtracting && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            'bg-black/50 backdrop-blur-sm'
          )}
        >
          <div className="bg-card rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <RiRefreshLine className="w-8 h-8 text-vibe-orange animate-spin" />
            <p className="font-inter font-medium text-ink">
              Re-analyzing call...
            </p>
            <p className="text-sm text-ink-muted">This may take a moment</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format model ID for display
 */
function formatModelName(modelId: string): string {
  // e.g., "anthropic/claude-3-haiku-20240307" -> "Claude 3 Haiku"
  if (modelId.includes('claude-3-haiku')) return 'Claude 3 Haiku';
  if (modelId.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
  if (modelId.includes('claude-3-opus')) return 'Claude 3 Opus';
  if (modelId.includes('gpt-4')) return 'GPT-4';
  if (modelId.includes('gpt-3.5')) return 'GPT-3.5';
  // Fallback: show last part of the path
  return modelId.split('/').pop() || modelId;
}
