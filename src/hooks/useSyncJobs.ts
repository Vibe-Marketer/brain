import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Shared, provider-agnostic sync-jobs hook (JOB-01 / JOB-03 / JOB-04).
 *
 * Lifted from the PRESERVED `useSyncTabState.ts` hybrid Realtime+poll machinery,
 * fixing the two Phase-26 carry-forward landmines and removing the 8s timer:
 *
 *  - JOB-01: ONE hook both <ImportSurface> tabs (Import + Sync) consume, so job
 *    status is readable on every surface from a single durable DB-backed source.
 *  - JOB-03: the unconditional 8-second `recentlyCompletedJobs` auto-dismiss is
 *    GONE. Failed / completed_with_errors jobs persist in `terminalJobs` until
 *    explicit dismissal (the Plan 27-03 banner owns dismissal, not this hook).
 *  - JOB-04: Realtime `postgres_changes` is PRIMARY; polling is the FALLBACK
 *    (10s backup while SUBSCRIBED, 2s when the channel closes/errors).
 *
 * Carry-forward fixes vs the lifted source:
 *  - Recording ids are `string[]` end-to-end (live columns are TEXT[]). No
 *    `parseInt`/`Number`/`Set<number>` coercion — dual-ID rule (src/CLAUDE.md).
 *  - No hardcoded `"fathom"`: rows are narrowed to the caller's `sourceApp` and
 *    `organizationId` CLIENT-SIDE, on top of the RLS user-OR-org boundary
 *    (RESEARCH Pattern 1). The channel `user_id=eq` filter + RLS is the real
 *    isolation boundary; source_app/org narrowing is a UI scoping concern only.
 *
 * DELETE Realtime events bypass RLS and can't be filtered (T-27-01-I2): they
 * only drop a row from the local list and never drive synced/status truth.
 */

export interface SyncJob {
  id: string;
  user_id: string;
  status: string;
  type?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at: string | null;
  error: string | null;
  // STRING ids — live columns are TEXT[]. Never number[].
  recording_ids: string[] | null;
  synced_ids: string[] | null;
  failed_ids: string[] | null;
  progress_current: number;
  progress_total: number;
  skipped_count?: number | null;
  source_app: string | null;
  organization_id: string | null;
  workspace_id?: string | null;
  source_id?: string | null;
  mode?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  provider_cursor?: string | null;
  last_heartbeat_at?: string | null;
}

interface UseSyncJobsArgs {
  /** The surface's provider (e.g. "fathom", "zoom"). Used to narrow rows. */
  sourceApp: string;
  /** Active organization id. Legacy NULL-org rows stay visible (OR-RLS). */
  organizationId?: string | null;
}

const ACTIVE_STATUSES = new Set(["pending", "processing"]);
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "completed_with_errors",
]);

/**
 * Returns `activeJobs` (pending/processing) and `terminalJobs`
 * (completed/failed/completed_with_errors) for the given surface, live-updated
 * via Realtime with a polling fallback. Terminal jobs are NEVER auto-removed.
 */
export function useSyncJobs({ sourceApp, organizationId }: UseSyncJobsArgs): {
  activeJobs: SyncJob[];
  terminalJobs: SyncJob[];
} {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Keep the narrowing predicate in a ref so the effect's handlers always see
  // the current sourceApp/organizationId without re-subscribing the channel.
  const matchesScopeRef = useRef<(job: SyncJob) => boolean>(() => true);
  matchesScopeRef.current = (job: SyncJob) => {
    if (job.source_app !== sourceApp) return false;
    if (organizationId) {
      // Legacy NULL-org rows stay visible (matches OR-combined RLS).
      if (job.organization_id != null && job.organization_id !== organizationId) {
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const upsertJob = (incoming: SyncJob) => {
      if (!matchesScopeRef.current(incoming)) return;
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === incoming.id);
        if (idx === -1) return [incoming, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      });
    };

    const dropJob = (id: string) => {
      setJobs((prev) => prev.filter((j) => j.id !== id));
    };

    const pollSyncJobs = async () => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user || !isMounted) return;

        const { data, error } = await supabase
          .from("sync_jobs")
          .select("*")
          .eq("user_id", user.id)
          .in("status", [
            "pending",
            "processing",
            "completed",
            "failed",
            "completed_with_errors",
          ])
          .order("created_at", { ascending: false });

        if (error || !isMounted) return;

        // Client-side narrowing ON TOP of RLS (RESEARCH Pattern 1). Ids stay
        // opaque strings — no coercion. Cast via unknown: the generated row
        // type and SyncJob are structurally close but not directly assignable.
        const scoped = ((data ?? []) as unknown as SyncJob[]).filter((j) =>
          matchesScopeRef.current(j),
        );
        setJobs(scoped);
      } catch (err) {
        logger.error("Error polling sync jobs", err);
      }
    };

    const setupRealtimeSubscription = async () => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user || !isMounted) return;

        // Initial fetch (also seeds terminal jobs that were already terminal).
        await pollSyncJobs();
        if (!isMounted) return;

        const channel = supabase
          .channel(`sync_jobs_${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "sync_jobs",
              // postgres_changes supports ONE predicate; user_id=eq + RLS is the
              // real isolation boundary. source_app/org narrowing is client-side.
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              if (!isMounted) return;
              logger.debug("Sync job realtime update", payload);

              if (payload.eventType === "INSERT") {
                upsertJob(payload.new as SyncJob);
              } else if (payload.eventType === "UPDATE") {
                // INSERT/UPDATE drive status truth (never DELETE).
                upsertJob(payload.new as SyncJob);
              } else if (payload.eventType === "DELETE") {
                // DELETE bypasses RLS + can't be filtered — only drop locally.
                const oldJob = payload.old as SyncJob;
                if (oldJob?.id) dropJob(oldJob.id);
              }
            },
          )
          .subscribe((status) => {
            logger.debug("Sync jobs realtime subscription status", status);
            if (status === "SUBSCRIBED") {
              // Realtime is primary — poll only as a slow backup.
              if (pollInterval) clearInterval(pollInterval);
              pollInterval = setInterval(pollSyncJobs, 10000);
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
              // Realtime down — fall back to fast polling.
              if (pollInterval) clearInterval(pollInterval);
              pollInterval = setInterval(pollSyncJobs, 2000);
            }
          });

        realtimeChannelRef.current = channel;

        // Start polling as the fallback until Realtime confirms SUBSCRIBED.
        pollInterval = setInterval(pollSyncJobs, 2000);
      } catch (err) {
        logger.error("Error setting up sync jobs monitoring", err);
        pollInterval = setInterval(pollSyncJobs, 2000);
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
    // sourceApp/organizationId narrowing flows through matchesScopeRef without
    // re-subscribing; the channel only depends on the authed user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.has(j.status));
  const terminalJobs = jobs.filter((j) => TERMINAL_STATUSES.has(j.status));

  return { activeJobs, terminalJobs };
}
