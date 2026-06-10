import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";
import { toRecordingUuidBatch } from "@/lib/recording-ids";

/**
 * Pure data-access layer for the meetings-sync flow.
 *
 * Hooks orchestrate. Services query and mutate. No React imports here —
 * everything is a plain async function so it stays testable, reusable, and
 * unmount-safe.
 *
 * If you find yourself reaching for `useState`/`useEffect`/`useRef`,
 * you're in the wrong file. Go back to `useMeetingsSync.ts`.
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** Raw transcript segment shape returned by the Fathom-style edge function. */
interface RawTranscriptSegment {
  timestamp: string;
  text: string;
  speaker?: {
    display_name?: string;
    matched_calendar_invitee_email?: string;
  };
}

/** Raw single-meeting payload returned by the `fetch-single-meeting` edge fn. */
export interface RawSingleMeeting {
  recording_id: number;
  title: string;
  created_at: string;
  url?: string;
  share_url?: string;
  recording_start_time?: string;
  recording_end_time?: string;
  recorded_by?: { name?: string; email?: string };
  calendar_invitees?: unknown;
  default_summary?: { markdown_formatted?: string | null } | null;
  transcript?: RawTranscriptSegment[];
}

export interface SingleMeetingPayload {
  meeting: RawSingleMeeting;
  userId: string;
}

export interface SyncJobRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  recording_ids: number[];
  progress_current: number;
  progress_total: number;
  synced_ids: number[] | null;
  failed_ids: number[] | null;
}

// --------------------------------------------------------------------------
// Auth + Edge invocation
// --------------------------------------------------------------------------

/**
 * One-shot helper that resolves the current user and invokes
 * `fetch-single-meeting`. Replaces three near-identical auth-then-invoke
 * triplicates that used to live inside the hook (sync, view, download).
 */
export async function fetchSingleMeetingViaEdge(
  recordingId: string,
): Promise<SingleMeetingPayload> {
  const { user, error: authError } = await getSafeUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke(
    "fetch-single-meeting",
    {
      body: { recording_id: parseInt(recordingId, 10), user_id: user.id },
    },
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.meeting) throw new Error("No meeting returned from edge function");

  return { meeting: data.meeting as RawSingleMeeting, userId: user.id };
}

// --------------------------------------------------------------------------
// Sync-job status
// --------------------------------------------------------------------------

/**
 * Fetches the current row for a sync job. Returns null on error rather than
 * throwing so the polling loop in the hook can drive its own teardown.
 */
export async function getSyncJob(jobId: string): Promise<SyncJobRow | null> {
  try {
    const { data, error } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) throw error;
    return data as SyncJobRow;
  } catch (error) {
    logger.error("Error checking sync status", error);
    return null;
  }
}

// --------------------------------------------------------------------------
// Tag-assignment lookups
// --------------------------------------------------------------------------

/**
 * Resolves a list of recording IDs (mixed legacy/UUID accepted) to the
 * tag_id currently assigned to each. Returns `{}` if none exist.
 */
export async function loadTagAssignmentsForRecordings(
  recordingIds: string[],
): Promise<Record<string, string>> {
  // call_tag_assignments.recording_id is UUID. Route through the canonical
  // helper so any legacy Fathom IDs are resolved to UUIDs (or dropped if
  // unsynced — i.e., no recordings-table row exists yet).
  const { uuids } = await toRecordingUuidBatch(recordingIds);
  if (uuids.length === 0) return {};

  try {
    const { data } = await supabase
      .from("call_tag_assignments")
      .select("recording_id, tag_id")
      .in("recording_id", uuids);

    const assignments: Record<string, string> = {};
    (data || []).forEach((assignment) => {
      assignments[assignment.recording_id] = assignment.tag_id;
    });
    return assignments;
  } catch (error) {
    logger.error("Error loading tag assignments", error);
    return {};
  }
}

// --------------------------------------------------------------------------
// Host email (user_settings)
// --------------------------------------------------------------------------

export async function loadHostEmail(): Promise<string | null> {
  try {
    const { user, error: authError } = await getSafeUser();
    if (authError || !user) return null;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("host_email")
      .eq("user_id", user.id)
      .single();

    return settings?.host_email ?? null;
  } catch (error) {
    logger.error("Error loading host email", error);
    return null;
  }
}

// --------------------------------------------------------------------------
// Persistence — moved out of the hook
// --------------------------------------------------------------------------

/**
 * Inserts a fathom_calls row + child fathom_transcripts rows for a single
 * synced meeting. Pure mutation; no React side effects.
 */
export async function persistSyncedMeeting(
  meeting: RawSingleMeeting,
  userId: string,
): Promise<void> {
  const fullTranscript =
    meeting.transcript && Array.isArray(meeting.transcript)
      ? meeting.transcript
          .map(
            (t) =>
              `[${t.timestamp}] ${t.speaker?.display_name || "Unknown"}: ${t.text}`,
          )
          .join("\n\n")
      : null;

  const summary = meeting.default_summary?.markdown_formatted || null;

  const { error: insertError } = await supabase.from("fathom_calls").insert({
    recording_id: meeting.recording_id,
    title: meeting.title,
    created_at: meeting.created_at,
    url: meeting.url,
    share_url: meeting.share_url,
    full_transcript: fullTranscript,
    summary,
    recorded_by_name: meeting.recorded_by?.name,
    recorded_by_email: meeting.recorded_by?.email,
    recording_start_time: meeting.recording_start_time,
    recording_end_time: meeting.recording_end_time,
    calendar_invitees: meeting.calendar_invitees,
    user_id: userId,
    synced_at: new Date().toISOString(),
  });

  if (insertError) throw insertError;

  if (meeting.transcript && Array.isArray(meeting.transcript)) {
    const transcriptInserts = meeting.transcript.map((t) => ({
      recording_id: meeting.recording_id,
      speaker_name: t.speaker?.display_name,
      speaker_email: t.speaker?.matched_calendar_invitee_email,
      text: t.text,
      timestamp: t.timestamp,
    }));

    await supabase.from("fathom_transcripts").insert(transcriptInserts);
  }
}

/**
 * Assigns a tag to a freshly synced recording. Resolves the legacy BIGINT
 * recording_id to the canonical UUID before insert — call_tag_assignments
 * keys on UUID (see migration 20260310125000).
 *
 * Silent no-op if the recordings row does not yet exist (i.e., the upstream
 * sync hasn't materialized the UUID yet). Matches prior hook behaviour.
 */
export async function assignTagToSyncedRecording(
  legacyRecordingId: number,
  tagId: string,
  userId: string,
): Promise<void> {
  const { data: recordingRow } = await supabase
    .from("recordings")
    .select("id")
    .eq("fathom_provider_id", legacyRecordingId)
    .maybeSingle();

  const recordingUuid = recordingRow?.id;
  if (!recordingUuid) {
    logger.error(
      `No UUID found for recording ${legacyRecordingId} — tag assignment skipped`,
    );
    return;
  }

  await supabase.from("call_tag_assignments").insert({
    recording_id: recordingUuid,
    tag_id: tagId,
    user_id: userId,
    auto_assigned: false,
  });
}

// --------------------------------------------------------------------------
// fetch-meetings + sync-meetings edge invocations
// --------------------------------------------------------------------------

export interface FetchMeetingsRange {
  createdAfter?: string;
  createdBefore?: string;
}

/**
 * Invokes the `fetch-meetings` edge function. Returns raw `data.meetings`
 * (typed as `unknown[]`) — the hook narrows it to `Meeting[]`.
 */
export async function invokeFetchMeetings(
  range: FetchMeetingsRange,
): Promise<unknown[]> {
  const { data, error } = await supabase.functions.invoke("fetch-meetings", {
    body: range,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.meetings as unknown[]) || [];
}

export interface InvokeSyncMeetingsArgs {
  recordingIds: number[];
  createdAfter?: string;
  createdBefore?: string;
  tagId?: string;
}

/** Invokes the `sync-meetings` edge function and returns the new job ID. */
export async function invokeSyncMeetings(
  args: InvokeSyncMeetingsArgs,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("sync-meetings", {
    body: {
      recordingIds: args.recordingIds,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      tag_id:
        args.tagId && args.tagId !== "none" ? args.tagId : undefined,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const jobId = data.jobId || data.job_id;
  if (!jobId) throw new Error("sync-meetings returned no jobId");
  return jobId as string;
}

// --------------------------------------------------------------------------
// Transcript formatter (pure)
// --------------------------------------------------------------------------

/**
 * Builds the plain-text transcript dump used by the download flow.
 * Pure function — no DOM, no I/O. The hook handles blob + click.
 */
export function formatUnsyncedTranscriptText(
  meeting: RawSingleMeeting,
): string {
  let out = `${meeting.title}\n`;
  out += `VIEW RECORDING - ${meeting.url || "N/A"}\n\n`;
  out += `---\n\n`;

  if (meeting.transcript && Array.isArray(meeting.transcript)) {
    meeting.transcript.forEach((segment) => {
      const timestamp = segment.timestamp || "00:00:00";
      const speaker = segment.speaker?.display_name || "Unknown";
      const text = segment.text || "";
      out += `${timestamp} - ${speaker}\n`;
      out += `  ${text}\n\n`;
    });
  } else {
    out += "No transcript available\n";
  }

  return out;
}
