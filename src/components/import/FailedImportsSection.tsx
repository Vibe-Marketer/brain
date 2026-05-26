/**
 * FailedImportsSection — Collapsible section showing failed import jobs.
 */

import { useEffect, useState } from 'react';
import {
  RiAlertLine,
  RiRefreshLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCloseLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import {
  useFailedImports,
  useRetryFailedImport,
  useClearFailedImports,
} from '@/hooks/useImportSources';
import { canRetryFailedImport } from '@/lib/connector-sync-functions';
import { getSourceLabel } from '@/lib/source-labels';
import { Checkbox } from '@/components/ui/checkbox';

export function FailedImportsSection() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: failedImports, isLoading } = useFailedImports();
  const retryMutation = useRetryFailedImport();
  const clearMutation = useClearFailedImports();

  useEffect(() => {
    if (!failedImports) {
      setSelectedIds([]);
      return;
    }

    const validIds = new Set(
      failedImports.map((item) => `${item.sync_job_id}:${item.failed_external_id}`)
    );
    setSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [failedImports]);

  if (isLoading || !failedImports || failedImports.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedIds);
  const allSelected = failedImports.length > 0 && selectedIds.length === failedImports.length;
  const isClearingAll = clearMutation.isPending && clearMutation.variables?.clearAll;

  const toggleSelected = (key: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, key])] : current.filter((id) => id !== key)
    );
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(
      checked ? failedImports.map((item) => `${item.sync_job_id}:${item.failed_external_id}`) : []
    );
  };

  const clearSelection = () => {
    if (selectedIds.length === 0) return;

    const selectedItems = failedImports.filter((item) =>
      selectedSet.has(`${item.sync_job_id}:${item.failed_external_id}`)
    );

    clearMutation.mutate(
      {
        failedExternalIds: selectedItems.map((item) => item.failed_external_id),
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            setSelectedIds([]);
          }
        },
      }
    );
  };

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
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="Select all failed imports"
              />
              Select all
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedIds.length === 0 || clearMutation.isPending}
                onClick={clearSelection}
                className={cn(
                  'shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium',
                  'text-foreground hover:bg-muted/60 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                Clear selected
              </button>
              <button
                type="button"
                disabled={clearMutation.isPending}
                onClick={() =>
                  clearMutation.mutate(
                    { clearAll: true },
                    {
                      onSuccess: (result) => {
                        if (result.success) {
                          setSelectedIds([]);
                        }
                      },
                    }
                  )
                }
                className={cn(
                  'shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium',
                  'text-foreground hover:bg-muted/60 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isClearingAll ? 'Clearing…' : 'Clear all'}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-border/40 px-4 pb-3">
            {failedImports.map((item) => {
              const sourceName = getSourceLabel(item.source_app);
              const canRetry = canRetryFailedImport(item.source_app);
              const itemKey = `${item.sync_job_id}:${item.failed_external_id}`;
              const isRetrying =
                retryMutation.isPending &&
                retryMutation.variables?.failedExternalId === item.failed_external_id;
              const isClearingItem =
                clearMutation.isPending &&
                clearMutation.variables?.syncJobId === item.sync_job_id &&
                clearMutation.variables?.failedExternalIds?.includes(item.failed_external_id);

              return (
                <li
                  key={`${item.sync_job_id}-${item.failed_external_id}`}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      checked={selectedSet.has(itemKey)}
                      onCheckedChange={(checked) => toggleSelected(itemKey, checked === true)}
                      aria-label={`Select failed import ${item.failed_external_id}`}
                      className="mt-0.5"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {item.title ?? sourceName}
                        </span>
                        {!item.title && (
                          <>
                            <span className="text-border">·</span>
                            <span className="max-w-[160px] truncate font-mono text-[11px] text-muted-foreground">
                              ID {item.failed_external_id}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        {item.error_message
                          ? item.error_message
                          : `${sourceName} call ${item.failed_external_id} failed to import`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={isClearingItem || clearMutation.isPending}
                      onClick={() =>
                        clearMutation.mutate({
                          syncJobId: item.sync_job_id,
                          failedExternalIds: [item.failed_external_id],
                        })
                      }
                      className={cn(
                        'flex items-center gap-1 rounded-md border border-border px-2 py-1',
                        'text-[11px] font-medium text-foreground',
                        'hover:bg-muted/60 transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <RiCloseLine size={11} aria-hidden="true" />
                      {isClearingItem ? 'Clearing…' : 'Clear'}
                    </button>

                    <button
                      type="button"
                      disabled={isRetrying || !canRetry}
                      onClick={() =>
                        retryMutation.mutate({
                          sourceApp: item.source_app,
                          failedExternalId: item.failed_external_id,
                        })
                      }
                      className={cn(
                        'flex items-center gap-1 rounded-md border border-border px-2.5 py-1',
                        'text-[11px] font-medium text-foreground',
                        'hover:bg-muted/60 transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <RiRefreshLine
                        size={11}
                        className={cn(isRetrying && 'animate-spin')}
                        aria-hidden="true"
                      />
                      {!canRetry ? 'Retry unavailable' : isRetrying ? 'Retrying…' : 'Retry'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
