import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RiLoader2Line } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface SyncJob {
  id: string;
  status: string;
  progress_current: number;
  progress_total: number;
  synced_ids: number[] | null;
  failed_ids: number[] | null;
  updated_at: string;
}

interface ActiveSyncJobsCardProps {
  activeSyncJobs: SyncJob[];
  onCancelJob: (jobId: string) => Promise<void>;
}

export function ActiveSyncJobsCard({ activeSyncJobs, onCancelJob }: ActiveSyncJobsCardProps) {
  if (activeSyncJobs.length === 0) return null;

  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <div className="space-y-3">
        {activeSyncJobs.map((job) => {
          const hasFailures = job.failed_ids && job.failed_ids.length > 0;
          const isComplete = job.status === 'completed_with_errors';
          const statusColor = hasFailures ? 'text-destructive' : 'text-primary';
          const isStuck = job.status === 'processing' &&
            new Date().getTime() - new Date(job.updated_at).getTime() > 5 * 60 * 1000; // 5 min

          return (
            <div key={job.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {!isComplete && <RiLoader2Line className="h-5 w-5 animate-spin text-primary" />}
                  <div>
                    <p className="text-sm font-medium">
                      {isComplete ? 'Sync Completed with Errors' : 'Background Sync in Progress'}
                      {isStuck && <span className="ml-2 text-orange-600 dark:text-orange-400">(Appears Stuck)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isComplete
                        ? `${job.synced_ids?.length || 0} succeeded, ${job.failed_ids?.length || 0} failed`
                        : isStuck
                          ? 'No progress for 5+ minutes - edge function may have timed out. Cancel and retry.'
                          : 'Sync will continue even if you refresh the page'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={cn("text-2xl font-bold", statusColor)}>
                      {job.progress_current}/{job.progress_total}
                    </p>
                    {hasFailures && (
                      <p className="text-xs text-destructive font-medium">
                        {job.failed_ids.length} failed
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">calls processed</p>
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
            </div>
          );
        })}
      </div>
    </Card>
  );
}
