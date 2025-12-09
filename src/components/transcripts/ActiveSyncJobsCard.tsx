import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RiLoader2Line, RiCheckLine, RiCloseLine, RiAlertLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { SyncJob } from "@/hooks/useSyncTabState";

interface ActiveSyncJobsCardProps {
  activeSyncJobs: SyncJob[];
  recentlyCompletedJobs?: SyncJob[];
  onCancelJob: (jobId: string) => Promise<void>;
}

export function ActiveSyncJobsCard({ activeSyncJobs, recentlyCompletedJobs = [], onCancelJob }: ActiveSyncJobsCardProps) {
  const hasActiveJobs = activeSyncJobs.length > 0;
  const hasCompletedJobs = recentlyCompletedJobs.length > 0;

  if (!hasActiveJobs && !hasCompletedJobs) return null;

  return (
    <div className="space-y-3 my-4">
      {/* Recently Completed Jobs - Success/Failure feedback */}
      {recentlyCompletedJobs.map((job) => {
        const hasFailures = job.failed_ids && job.failed_ids.length > 0;
        const isFullyFailed = job.status === 'failed';
        const syncedCount = job.synced_ids?.length || 0;
        const failedCount = job.failed_ids?.length || 0;

        let bgColor = 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
        let icon = <RiCheckLine className="h-5 w-5 text-green-600 dark:text-green-400" />;
        let title = 'Sync Complete';
        let subtitle = `${syncedCount} meeting${syncedCount !== 1 ? 's' : ''} synced successfully`;

        if (isFullyFailed) {
          bgColor = 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
          icon = <RiCloseLine className="h-5 w-5 text-red-600 dark:text-red-400" />;
          title = 'Sync Failed';
          subtitle = job.error_message || 'Failed to sync meetings';
        } else if (hasFailures) {
          bgColor = 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
          icon = <RiAlertLine className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
          title = 'Sync Completed with Errors';
          subtitle = `${syncedCount} synced, ${failedCount} failed`;
        }

        return (
          <Card key={job.id} className={cn("p-4 border", bgColor)}>
            <div className="flex items-center gap-3">
              {icon}
              <div className="flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">Auto-dismissing...</p>
            </div>
          </Card>
        );
      })}

      {/* Active Sync Jobs - In-progress */}
      {activeSyncJobs.map((job) => {
        const hasFailures = job.failed_ids && job.failed_ids.length > 0;
        const statusColor = hasFailures ? 'text-destructive' : 'text-primary';
        const isStuck = job.status === 'processing' &&
          new Date().getTime() - new Date(job.updated_at).getTime() > 5 * 60 * 1000; // 5 min

        return (
          <Card key={job.id} className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <RiLoader2Line className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      Syncing in Progress
                    </span>
                    {isStuck && <span className="ml-2 text-orange-600 dark:text-orange-400">(Appears Stuck)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isStuck
                      ? 'No progress for 5+ minutes - edge function may have timed out. Cancel and retry.'
                      : 'Real-time updates • Sync continues even if you refresh'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={cn("text-2xl font-bold tabular-nums", statusColor)}>
                    {job.progress_current}/{job.progress_total}
                  </p>
                  {hasFailures && (
                    <p className="text-xs text-destructive font-medium">
                      {job.failed_ids?.length || 0} failed
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">meetings saved</p>
                </div>
                {job.status === 'processing' && (
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={() => onCancelJob(job.id)}
                    className={cn(isStuck && "border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950")}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <Progress
              value={(job.progress_current / job.progress_total) * 100}
              className={cn("h-2", hasFailures && "bg-destructive/20")}
            />
          </Card>
        );
      })}
    </div>
  );
}
