/**
 * FailedImportsSection — Collapsible section showing failed import jobs.
 */

import { useState } from 'react';
import { RiAlertLine, RiRefreshLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFailedImports, useRetryFailedImport } from '@/hooks/useImportSources';

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  fathom: 'Fathom',
  zoom: 'Zoom',
  youtube: 'YouTube',
  'file-upload': 'File Upload',
};

export function FailedImportsSection() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data: failedImports, isLoading } = useFailedImports();
  const retryMutation = useRetryFailedImport();

  if (isLoading || !failedImports || failedImports.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3',
          'text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl',
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <RiAlertLine size={15} className="text-red-500 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            Failed Imports
          </span>
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
            {failedImports.length}
          </span>
        </div>
        {isExpanded ? (
          <RiArrowUpSLine size={16} className="text-muted-foreground" aria-hidden="true" />
        ) : (
          <RiArrowDownSLine size={16} className="text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <ul className="divide-y divide-border/40 px-4 pb-3">
          {failedImports.map((item) => {
            const sourceName = SOURCE_DISPLAY_NAMES[item.source_app] ?? item.source_app;
            const isFileUpload = item.source_app === 'file-upload';
            const isRetrying =
              retryMutation.isPending &&
              retryMutation.variables?.failedExternalId === item.failed_external_id;

            return (
              <li
                key={`${item.sync_job_id}-${item.failed_external_id}`}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{sourceName}</span>
                    <span className="text-border">·</span>
                    <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px]">
                      {item.failed_external_id}
                    </span>
                  </div>
                  {item.error_message && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {item.error_message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={() =>
                    retryMutation.mutate({
                      sourceApp: item.source_app,
                      failedExternalId: item.failed_external_id,
                    })
                  }
                  className={cn(
                    'shrink-0 flex items-center gap-1 rounded-md border border-border px-2.5 py-1',
                    'text-[11px] font-medium text-foreground',
                    'hover:bg-muted/60 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <RiRefreshLine
                    size={11}
                    className={cn(isRetrying && 'animate-spin')}
                    aria-hidden="true"
                  />
                  {isFileUpload ? 'Re-upload file' : isRetrying ? 'Retrying…' : 'Retry'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
