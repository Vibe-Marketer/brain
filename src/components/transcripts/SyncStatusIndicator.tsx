import { RiLoader2Line, RiCheckLine, RiAlertLine, RiArrowRightLine } from "@remixicon/react";
import type { SyncJob } from "@/hooks/useSyncTabState";

interface SyncStatusIndicatorProps {
  activeSyncJobs: SyncJob[];
  recentlyCompletedJobs: SyncJob[];
  onViewSynced?: () => void;
}

export function SyncStatusIndicator({ activeSyncJobs, recentlyCompletedJobs, onViewSynced }: SyncStatusIndicatorProps) {
  const hasActiveJobs = activeSyncJobs.length > 0;
  const hasCompletedJobs = recentlyCompletedJobs.length > 0;

  if (!hasActiveJobs && !hasCompletedJobs) return null;

  // Calculate totals across all active jobs
  const totalProgress = activeSyncJobs.reduce((acc, job) => acc + job.progress_current, 0);
  const totalTarget = activeSyncJobs.reduce((acc, job) => acc + job.progress_total, 0);

  // Get the most recent completed job for status display
  const lastCompletedJob = recentlyCompletedJobs[recentlyCompletedJobs.length - 1];
  const hasFailures = lastCompletedJob?.failed_ids && lastCompletedJob.failed_ids.length > 0;
  const isFullyFailed = lastCompletedJob?.status === 'failed';

  // Active sync in progress
  if (hasActiveJobs) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
        </span>
        <span className="text-sm font-medium text-primary">
          Syncing
        </span>
        <span className="text-sm font-bold text-primary tabular-nums">
          {totalProgress}/{totalTarget}
        </span>
        <RiLoader2Line className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  // Recently completed - show brief success/failure indicator with View button
  if (hasCompletedJobs && lastCompletedJob) {
    const syncedCount = lastCompletedJob.synced_ids?.length || 0;
    const failedCount = lastCompletedJob.failed_ids?.length || 0;

    if (isFullyFailed) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-full">
          <RiAlertLine className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            Sync Failed
          </span>
        </div>
      );
    }

    if (hasFailures) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-full">
          <RiAlertLine className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            {syncedCount} synced, {failedCount} failed
          </span>
          {onViewSynced && syncedCount > 0 && (
            <button
              onClick={onViewSynced}
              className="ml-1 text-sm font-medium text-orange-700 dark:text-orange-300 hover:underline inline-flex items-center gap-0.5"
            >
              View <RiArrowRightLine className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-full">
        <RiCheckLine className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          {syncedCount} synced
        </span>
        {onViewSynced && syncedCount > 0 && (
          <button
            onClick={onViewSynced}
            className="ml-1 text-sm font-medium text-green-700 dark:text-green-300 hover:underline inline-flex items-center gap-0.5"
          >
            View <RiArrowRightLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return null;
}
