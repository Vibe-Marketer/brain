/**
 * Composio Webex normalizer — @composio-unverified
 *
 * Maps a Webex meeting recording + transcript payload into the canonical
 * recording shape. Webex delivers recording-ready triggers through
 * Composio, so this normalizer runs on a webhook ingestion path.
 *
 * Status: SCAFFOLD. Field names below reflect Webex's recordings + meeting
 * transcripts REST API. Verify against a real Composio Webex payload
 * before relying on this in production.
 */

import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from "../canonical-recording.ts";

export interface WebexRecordingPayload {
  recording?: WebexRecording | null;
  /** Webex transcripts come from a separate endpoint; Composio joins them. */
  transcript?: WebexTranscriptSegment[] | null;
  /** Optional meeting metadata when Composio attaches it. */
  meeting?: WebexMeeting | null;
  connected_account_id?: string | null;
}

export interface WebexRecording {
  id?: string | null;
  meetingId?: string | null;
  topic?: string | null;
  createTime?: string | null;
  timeRecorded?: string | null;
  durationSeconds?: number | null;
  hostEmail?: string | null;
  hostDisplayName?: string | null;
  playbackUrl?: string | null;
  downloadUrl?: string | null;
  format?: string | null;
}

export interface WebexMeeting {
  id?: string | null;
  title?: string | null;
  start?: string | null;
  end?: string | null;
  hostEmail?: string | null;
  hostDisplayName?: string | null;
  invitees?: Array<{
    email?: string | null;
    displayName?: string | null;
  }> | null;
}

export interface WebexTranscriptSegment {
  text?: string | null;
  speaker?: string | null;
  speakerEmail?: string | null;
  startTime?: number | string | null;
  endTime?: number | string | null;
}

export function webexRecordingToCanonical(
  payload: WebexRecordingPayload,
): CanonicalRecording {
  const recording = payload.recording ?? {};
  const meeting = payload.meeting ?? null;

  const externalId = recording.id ?? meeting?.id ?? null;
  if (!externalId) {
    throw new Error(
      "[composio-normalizer:webex] payload is missing recording.id and meeting.id",
    );
  }

  const turns = (payload.transcript ?? [])
    .map(webexSegmentToTurn)
    .filter(Boolean) as CanonicalTranscriptTurn[];
  const fullTranscript = formatCanonicalTranscript(turns);

  const startTime = coerceWebexDate(
    recording.timeRecorded ?? recording.createTime ?? meeting?.start,
  );
  const durationSeconds = normalizeDurationSeconds(recording.durationSeconds);
  const endTime = meeting?.end
    ? safeCoerceWebexDate(meeting.end)
    : durationSeconds != null
      ? new Date(
          new Date(startTime).getTime() + durationSeconds * 1000,
        ).toISOString()
      : null;

  const hostEmail = recording.hostEmail ?? meeting?.hostEmail ?? null;
  const inviteeEmails = (meeting?.invitees ?? [])
    .map((invitee) => invitee.email)
    .filter((email): email is string => typeof email === "string");

  return {
    externalId,
    sourceApp: "webex",
    title: recording.topic?.trim() || meeting?.title?.trim() || "Webex Meeting",
    fullTranscript,
    recordingStartTime: startTime,
    recordingEndTime: endTime,
    durationSeconds,
    sourceUrl: recording.playbackUrl ?? recording.downloadUrl ?? null,
    shareUrl: recording.playbackUrl ?? null,
    recordedByEmail: hostEmail,
    recordedByName:
      recording.hostDisplayName ?? meeting?.hostDisplayName ?? null,
    participantEmails: normalizeEmailList(
      [hostEmail, ...inviteeEmails].filter(Boolean) as string[],
    ),
    calendarInvitees: meeting?.invitees ?? [],
    sourceMetadata: {
      webex_recording_id: recording.id ?? null,
      webex_meeting_id: meeting?.id ?? null,
      webex_format: recording.format ?? null,
      webex_playback_url: recording.playbackUrl ?? null,
      webex_download_url: recording.downloadUrl ?? null,
      composio_connected_account_id: payload.connected_account_id ?? null,
      composio_routed: true,
    },
    rawPayload: payload,
  };
}

function webexSegmentToTurn(
  segment: WebexTranscriptSegment,
): CanonicalTranscriptTurn | null {
  const text = segment.text?.trim();
  if (!text) return null;
  return {
    speakerName: segment.speaker ?? "Unknown",
    speakerEmail: segment.speakerEmail ?? null,
    text,
    startSeconds: coerceOffsetSeconds(segment.startTime),
    endSeconds: coerceOffsetSeconds(segment.endTime),
  };
}

function coerceWebexDate(value: string | null | undefined): string {
  const iso = safeCoerceWebexDate(value);
  if (!iso) {
    throw new Error(
      "[composio-normalizer:webex] could not derive a valid recording start time",
    );
  }
  return iso;
}

function safeCoerceWebexDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function coerceOffsetSeconds(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDurationSeconds(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}
