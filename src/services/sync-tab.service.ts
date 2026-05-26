import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";
import { toRecordingUuidBatch } from "@/lib/recording-ids";
import type { DateRange } from "react-day-picker";
import type {
  Meeting,
  CalendarInvitee,
} from "@/hooks/useMeetingsSync";

/**
 * Pure data-access layer for the Sync tab.
 *
 * Hooks orchestrate. Services query and mutate. No React imports here —
 * everything is a plain async function so it stays testable, reusable, and
 * unmount-safe.
 *
 * If you find yourself reaching for `useState`/`useEffect`/`useRef`, you're
 * in the wrong file. Go back to `useExistingTranscripts.ts` and friends.
 *
 * The companion file `meetings-sync.service.ts` owns the single-meeting flow
 * (legacy Fathom edge invocations + persist + assignTag). This file owns the
 * Sync-tab-specific surface: listing existing synced calls, cancelling a job,
 * and multi-tag assignment lookups.
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface SyncedCallsFilters {
  dateRange: DateRange | undefined;
  page: number;
  pageSize: number;
  organizationId?: string | null;
}

export interface SyncedCallsResult {
  rows: Meeting[];
  tagAssignments: Record<string, string[]>;
  totalCount: number;
}

// --------------------------------------------------------------------------
// Existing synced transcripts (paginated)
// --------------------------------------------------------------------------

/**
 * Fetches the paginated list of already-synced calls for the current user,
 * plus the per-row tag assignment map. Returns an empty result if the user
 * is not authenticated — no throw, the UI shows the empty state.
 *
 * Mirrors the prior inline behaviour:
 *   - filters fathom_calls by user_id
 *   - only primary rows (is_primary=true or null for backward compatibility)
 *   - applies date range at the DB level (UTC bounds)
 *   - paginates server-side
 *   - returns rows + a `recording_id -> tag_id[]` map for the visible page
 */
export async function fetchSyncedCalls(
  filters: SyncedCallsFilters,
): Promise<SyncedCallsResult> {
  const empty: SyncedCallsResult = {
    rows: [],
    tagAssignments: {},
    totalCount: 0,
  };

  try {
    const { user, error: authError } = await getSafeUser();
    if (authError || !user) return empty;

    // Phase 9 migration TODO: when recordings becomes the read source for
    // synced calls, branch here on a probe of the recordings table for
    // `filters.organizationId`. Today the read still comes from fathom_calls
    // (the prior inline code computed a `useRecordings` value it never used).

    let query = supabase
      .from("fathom_calls")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .or("is_primary.is.null,is_primary.eq.true")
      .order("created_at", { ascending: false });

    if (filters.dateRange?.from) {
      const filterStart = new Date(
        Date.UTC(
          filters.dateRange.from.getFullYear(),
          filters.dateRange.from.getMonth(),
          filters.dateRange.from.getDate(),
          0,
          0,
          0,
          0,
        ),
      ).toISOString();
      query = query.gte("created_at", filterStart);
    }

    if (filters.dateRange?.to) {
      const filterEnd = new Date(
        Date.UTC(
          filters.dateRange.to.getFullYear(),
          filters.dateRange.to.getMonth(),
          filters.dateRange.to.getDate(),
          23,
          59,
          59,
          999,
        ),
      ).toISOString();
      query = query.lte("created_at", filterEnd);
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows: Meeting[] = (data || []).map((t) => ({
      recording_id: String(t.recording_id),
      title: t.title,
      created_at: t.created_at,
      recording_start_time: t.recording_start_time,
      recording_end_time: t.recording_end_time,
      full_transcript: t.full_transcript,
      summary: t.summary,
      url: t.url,
      share_url: t.share_url,
      recorded_by_name: t.recorded_by_name,
      recorded_by_email: t.recorded_by_email,
      synced: true,
      calendar_invitees: t.calendar_invitees as unknown as CalendarInvitee[],
    }));

    let tagAssignments: Record<string, string[]> = {};
    if (data && data.length > 0) {
      const recordingIds = data.map((t) => t.recording_id);
      tagAssignments = await loadTagAssignmentsForRecordings(recordingIds);
    }

    return {
      rows,
      tagAssignments,
      totalCount: count || 0,
    };
  } catch (error) {
    logger.error("Error loading existing transcripts", error);
    return empty;
  }
}

// --------------------------------------------------------------------------
// Tag assignment lookups (multi-tag map)
// --------------------------------------------------------------------------

/**
 * Returns the `recording_id -> tag_id[]` map for the supplied recording ids.
 *
 * Mixed legacy/UUID inputs are routed through `toRecordingUuidBatch` first —
 * `call_tag_assignments.recording_id` is UUID and a raw legacy BIGINT causes
 * Postgres to throw `invalid input syntax for type uuid`.
 *
 * Distinct from `meetings-sync.service.ts.loadTagAssignmentsForRecordings`,
 * which returns a `recording_id -> tag_id` (single tag) map used by the
 * unsynced single-meeting flow. SyncTab needs the multi-tag form so a single
 * recording with two tags renders both pills.
 */
export async function loadTagAssignmentsForRecordings(
  recordingIds: (string | number)[],
): Promise<Record<string, string[]>> {
  const stringIds = recordingIds.map((id) => String(id));
  const { uuids } = await toRecordingUuidBatch(stringIds);
  if (uuids.length === 0) return {};

  try {
    const { data } = await supabase
      .from("call_tag_assignments")
      .select("recording_id, tag_id")
      .in("recording_id", uuids);

    const assignments: Record<string, string[]> = {};
    (data || []).forEach((assignment) => {
      const key = assignment.recording_id;
      if (!assignments[key]) assignments[key] = [];
      assignments[key].push(assignment.tag_id);
    });
    return assignments;
  } catch (error) {
    logger.error("Error loading tag assignments", error);
    return {};
  }
}

// --------------------------------------------------------------------------
// Sync-job cancellation
// --------------------------------------------------------------------------

/**
 * Cancels a sync job by setting status=failed and completed_at=now(). Throws
 * on DB error so the mutation hook can surface a toast.
 */
export async function cancelSyncJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("sync_jobs")
    .update({
      status: "failed",
      error_message: "Cancelled by user",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw error;
}

// --------------------------------------------------------------------------
// Active sync jobs snapshot (replaces the prior setTimeout-based refetch)
// --------------------------------------------------------------------------

/**
 * Returns every sync_jobs row currently pending or processing. Used by the
 * cancel mutation's onSuccess to repopulate the active-jobs list without
 * round-tripping through the realtime channel.
 */
export async function listActiveSyncJobs(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Returns sync_jobs rows for the supplied ids. Used immediately after a sync
 * has been kicked off so the UI can show progress without waiting for the
 * realtime channel / polling tick.
 */
export async function listSyncJobsByIds(jobIds: string[]): Promise<unknown[]> {
  if (jobIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .in("id", jobIds);

  if (error) throw error;
  return data || [];
}

// --------------------------------------------------------------------------
// sync-meetings edge invocation (Sync-tab variant — carries workspace_id)
// --------------------------------------------------------------------------

export interface InvokeSyncMeetingsForTabArgs {
  recordingIds: number[];
  createdAfter?: string;
  createdBefore?: string;
  workspaceId?: string;
}

export interface InvokeSyncMeetingsForTabResult {
  jobId: string;
  total: number;
}

/**
 * Sync-tab variant of `invokeSyncMeetings` — accepts an optional
 * `workspace_id` so the Sync tab can route the inserted rows to the
 * currently selected workspace. Returns `{ jobId, total }` so the caller
 * can render aggregate progress for multi-source syncs.
 */
export async function invokeSyncMeetingsForTab(
  args: InvokeSyncMeetingsForTabArgs,
): Promise<InvokeSyncMeetingsForTabResult> {
  const { data, error } = await supabase.functions.invoke("sync-meetings", {
    body: {
      recordingIds: args.recordingIds,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      workspace_id: args.workspaceId || undefined,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const jobId: string | undefined = data?.jobId || data?.job_id;
  if (!jobId) throw new Error("sync-meetings returned no jobId");

  return { jobId, total: args.recordingIds.length };
}

// --------------------------------------------------------------------------
// Connector-source fetch (Fathom legacy + multi-source search)
// --------------------------------------------------------------------------

export interface FathomFetchMeetingsArgs {
  createdAfter: string;
  createdBefore: string;
}

/**
 * Sync-tab variant of `invokeFetchMeetings` — returns the raw `data.meetings`
 * payload from the Fathom-legacy `fetch-meetings` edge function. Callers
 * decorate with `source_platform: "fathom"` and merge with connector results.
 */
export async function invokeFathomFetchMeetings(
  args: FathomFetchMeetingsArgs,
): Promise<unknown[]> {
  const { data, error } = await supabase.functions.invoke("fetch-meetings", {
    body: {
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.meetings as unknown[]) || [];
}

// --------------------------------------------------------------------------
// Sync-status check for unsynced meeting list
// --------------------------------------------------------------------------

/**
 * Returns the set of recording ids (as strings) that already exist in
 * `fathom_calls` for the current user. Used to mark already-synced rows in
 * the unsynced meetings table.
 */
export async function checkSyncedRecordingIds(
  recordingIds: string[],
): Promise<Set<string>> {
  try {
    const { user, error: authError } = await getSafeUser();
    if (authError || !user) return new Set();

    const numericIds = recordingIds
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id));
    if (numericIds.length === 0) return new Set();

    const { data: syncedCalls } = await supabase
      .from("fathom_calls")
      .select("recording_id")
      .eq("user_id", user.id)
      .in("recording_id", numericIds);

    return new Set(
      (syncedCalls || []).map((c) => String(c.recording_id)),
    );
  } catch (error) {
    logger.error("Error checking sync status", error);
    return new Set();
  }
}
