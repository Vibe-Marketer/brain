import {
  RiLoader2Line,
  RiCheckLine,
  RiAlertLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiRefreshLine,
} from "@remixicon/react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { canRetryFailedImport } from "@/lib/connector-sync-functions";
import type { SyncJob } from "@/hooks/useSyncJobs";

/**
 * SyncJobBanner — durable, presentational job-status banner (JOB-03).
 *
 * Evolved from the PRESERVED `ActiveSyncJobsCard`/`SyncStatusIndicator`, with
 * the two regressions deliberately removed:
 *   - the old auto-dismiss copy + any timer that could silently drop failures, and
 *   - the client-side 5-minute "Appears Stuck" heuristic (the reaper, Plan 27-02,
 *     now owns stuck->failed; the UI never guesses).
 *
 * There is NO timer anywhere in this component — failures and partial successes
 * leave the DOM only via the user-driven dismiss control.
 *
 * Behaviour is driven entirely off the `sync_jobs` row's `status`:
 *   - pending / processing → progress banner (progress_current/progress_total)
 *   - completed (clean)     → success banner with a dismiss control (no timer)
 *   - completed_with_errors → "{synced} of {requested} imported, {failed} failed"
 *       (+ informational "{skipped} already synced (skipped)" when >0) — STICKY, dismiss
 *   - failed                → error banner (job.error) — STICKY, dismiss
 *
 * Failure / partial banners NEVER auto-dismiss. The only way they leave the DOM
 * is the user clicking the dismiss control, which calls `onDismiss(job.id)` —
 * a local "I've seen it" signal owned by <ImportSurface>, never a DB delete.
 *
 * FAIL-02 retry action: partial (completed_with_errors) and failed banners with
 * a non-empty `failed_ids` set surface a "Retry failed (N)" control. The banner
 * stays PRESENTATIONAL — it calls the optional `onRetry(source_app, failed_ids)`
 * prop (mirroring `onDismiss`); the parent <ImportSurface> owns the mutation and
 * dispatches each id through the EXISTING single-call retry path
 * (useRetryFailedImport -> retryFailedImport -> { singleCallId }). Retry targets
 * ONLY failed_ids — never the already-synced or skipped ids — and is idempotent
 * (Phase 24 org-scoped unique index makes a retry of an actually-imported call a
 * no-op). Providers without a connector sync fn (file-upload) are gated via
 * `canRetryFailedImport`.
 *
 * Ids are opaque strings: counts use `.length` on the string[] arrays only —
 * never parseInt/Number coercion (dual-ID rule, src/CLAUDE.md). failed_ids are
 * passed to onRetry verbatim.
 */

export interface SyncJobBannerProps {
  job: SyncJob;
  onDismiss: (jobId: string) => void;
  /**
   * Optional FAIL-02 retry handler. Called with the job's provider and the EXACT
   * failed_ids set to re-attempt through the existing single-call retry path.
   * When omitted, no retry affordance renders (the banner stays display-only).
   */
  onRetry?: (sourceApp: string, failedIds: string[]) => void;
}

export function SyncJobBanner({ job, onDismiss, onRetry }: SyncJobBannerProps) {
  const syncedCount = job.synced_ids?.length ?? 0;
  const failedCount = job.failed_ids?.length ?? 0;
  const skippedCount = job.skipped_count ?? 0;
  // "requested" = total recordings requested for this job. Prefer the job's own
  // progress_total; fall back to synced+failed+skipped for legacy rows that
  // never set it, so the "of N" denominator always stays truthful.
  const requestedCount =
    job.progress_total || syncedCount + failedCount + skippedCount;

  // --- Active (pending / processing): progress banner, no dismiss --------
  if (job.status === "pending" || job.status === "processing") {
    const total = job.progress_total || 0;
    const pct = total > 0 ? (job.progress_current / total) * 100 : 0;
    return (
      <div
        role="status"
        aria-label={`Syncing ${job.progress_current} of ${job.progress_total}`}
        className="rounded-lg border border-primary/20 bg-primary/5 p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <RiLoader2Line className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Syncing in progress
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sync continues even if you refresh
              </p>
            </div>
          </div>
          <p className="text-right text-2xl font-bold tabular-nums text-primary">
            {job.progress_current}/{job.progress_total}
          </p>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
    );
  }

  // --- Failed: error banner, STICKY, explicit dismiss only ---------------
  if (job.status === "failed") {
    return (
      <DismissibleBanner
        job={job}
        onDismiss={onDismiss}
        onRetry={onRetry}
        tone="error"
        icon={
          <RiErrorWarningLine className="h-5 w-5 text-red-600 dark:text-red-400" />
        }
        title="Sync failed"
        subtitle={job.error || "Failed to sync. Try again."}
      />
    );
  }

  // --- Completed with errors: partial success, STICKY, dismiss -----------
  if (job.status === "completed_with_errors") {
    return (
      <DismissibleBanner
        job={job}
        onDismiss={onDismiss}
        onRetry={onRetry}
        tone="warning"
        icon={
          <RiAlertLine className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        }
        title="Sync completed with errors"
        subtitle={
          <>
            <span className="tabular-nums">{syncedCount}</span> of{" "}
            <span className="tabular-nums">{requestedCount}</span> imported,{" "}
            <span className="tabular-nums">{failedCount}</span> failed
            {skippedCount > 0 && (
              <span className="text-muted-foreground/70">
                {" "}
                &middot; <span className="tabular-nums">{skippedCount}</span>{" "}
                already synced (skipped)
              </span>
            )}
          </>
        }
      />
    );
  }

  // --- Completed (clean): success banner, dismissible (no timer) ----------
  if (job.status === "completed") {
    return (
      <DismissibleBanner
        job={job}
        onDismiss={onDismiss}
        tone="success"
        icon={
          <RiCheckLine className="h-5 w-5 text-green-600 dark:text-green-400" />
        }
        title="Sync complete"
        subtitle={
          <>
            <span className="tabular-nums">{syncedCount}</span> meeting
            {syncedCount === 1 ? "" : "s"} synced
          </>
        }
      />
    );
  }

  return null;
}

interface DismissibleBannerProps {
  job: SyncJob;
  onDismiss: (jobId: string) => void;
  onRetry?: (sourceApp: string, failedIds: string[]) => void;
  tone: "success" | "warning" | "error";
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
}

const TONE_CLASSES: Record<DismissibleBannerProps["tone"], string> = {
  success:
    "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
  warning:
    "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
  error: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
};

function DismissibleBanner({
  job,
  onDismiss,
  onRetry,
  tone,
  icon,
  title,
  subtitle,
}: DismissibleBannerProps) {
  // FAIL-02: opaque TEXT failed_ids passed verbatim (no coercion). N = .length.
  const failedIds = job.failed_ids ?? [];
  const sourceApp = job.source_app ?? "";
  // Retry affordance renders only when the parent supplies a handler AND there is
  // an actual failure set to re-attempt.
  const showRetry = !!onRetry && failedIds.length > 0;
  // Providers without a connector sync fn (e.g. file-upload) cannot retry — the
  // button renders disabled with an explanatory label (mirrors FailedImportsSection).
  const canRetry = canRetryFailedImport(sourceApp);

  return (
    <div
      role="status"
      className={cn("flex items-center gap-3 rounded-lg border p-4", TONE_CLASSES[tone])}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {showRetry ? (
        <button
          type="button"
          disabled={!canRetry}
          aria-label={`Retry failed (${failedIds.length})`}
          title={
            canRetry
              ? undefined
              : "This provider does not support retrying failed imports"
          }
          onClick={() => onRetry?.(sourceApp, failedIds)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1",
            "text-[11px] font-medium text-foreground",
            "hover:bg-muted/60 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <RiRefreshLine className="h-3.5 w-3.5" aria-hidden="true" />
          {canRetry ? (
            <>
              Retry failed (
              <span className="tabular-nums">{failedIds.length}</span>)
            </>
          ) : (
            "Retry unavailable"
          )}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(job.id)}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <RiCloseLine className="h-4 w-4" />
      </button>
    </div>
  );
}
