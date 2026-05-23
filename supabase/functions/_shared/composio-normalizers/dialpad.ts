/**
 * Composio Dialpad normalizer — @composio-unverified
 *
 * Maps a Dialpad call recording + transcript payload into the canonical
 * recording shape. Dialpad delivers call-recording-ready triggers through
 * Composio, so this normalizer runs on a webhook ingestion path
 * (composio-trigger-webhook) — not a polling loop.
 *
 * Status: SCAFFOLD. Field names below reflect Dialpad's public REST API
 * surface (v2 calls + transcripts endpoints). Verify against a real
 * Composio Dialpad payload before relying on this in production.
 */

import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from "../canonical-recording.ts";

export interface DialpadCallPayload {
  call_id?: string | number | null;
  /** Dialpad call detail metadata. */
  call?: DialpadCallMeta | null;
  /** Optional transcript blob; absent when only the recording is ready. */
  transcript?: DialpadTranscriptEntry[] | null;
  /** Composio echoes back the connected_account_id on webhook deliveries. */
  connected_account_id?: string | null;
}

export interface DialpadCallMeta {
  id?: string | number | null;
  internal_number?: string | null;
  external_number?: string | null;
  direction?: "inbound" | "outbound" | string | null;
  date_started?: string | number | null;
  date_ended?: string | number | null;
  duration?: number | null;
  recording_url?: string | null;
  target?: DialpadUser | null;
  contact?: DialpadContact | null;
}

export interface DialpadUser {
  email?: string | null;
  name?: string | null;
}

export interface DialpadContact {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}

export interface DialpadTranscriptEntry {
  content?: string | null;
  name?: string | null;
  email?: string | null;
  start_time?: number | string | null;
  end_time?: number | string | null;
  speaker_type?: "user" | "contact" | string | null;
}

export function dialpadCallToCanonical(
  payload: DialpadCallPayload,
): CanonicalRecording {
  const meta = payload.call ?? {};
  const externalId = coerceExternalId(meta.id ?? payload.call_id);

  const turns = (payload.transcript ?? [])
    .map(dialpadEntryToTurn)
    .filter(Boolean) as CanonicalTranscriptTurn[];
  const fullTranscript = formatCanonicalTranscript(turns);

  const startTime = coerceDialpadDate(meta.date_started);
  const endTime = meta.date_ended
    ? safeCoerceDialpadDate(meta.date_ended)
    : null;
  const durationSeconds = normalizeDurationSeconds(meta.duration);

  const targetEmail = meta.target?.email ?? null;
  const contactEmail = meta.contact?.email ?? null;

  return {
    externalId,
    sourceApp: "dialpad",
    title: buildDialpadTitle(meta),
    fullTranscript,
    recordingStartTime: startTime,
    recordingEndTime: endTime,
    durationSeconds,
    sourceUrl: meta.recording_url ?? null,
    shareUrl: meta.recording_url ?? null,
    recordedByEmail: targetEmail,
    recordedByName: meta.target?.name ?? null,
    participantEmails: normalizeEmailList(
      [targetEmail, contactEmail].filter(
        (email): email is string => typeof email === "string",
      ),
    ),
    calendarInvitees: [],
    sourceMetadata: {
      dialpad_call_id: externalId,
      dialpad_direction: meta.direction ?? null,
      dialpad_internal_number: meta.internal_number ?? null,
      dialpad_external_number: meta.external_number ?? null,
      dialpad_contact_phone: meta.contact?.phone ?? null,
      composio_connected_account_id: payload.connected_account_id ?? null,
      composio_routed: true,
    },
    rawPayload: payload,
  };
}

function dialpadEntryToTurn(
  entry: DialpadTranscriptEntry,
): CanonicalTranscriptTurn | null {
  const text = entry.content?.trim();
  if (!text) return null;

  return {
    speakerName: entry.name ?? "Unknown",
    speakerEmail: entry.email ?? null,
    text,
    startSeconds: coerceOffsetSeconds(entry.start_time),
    endSeconds: coerceOffsetSeconds(entry.end_time),
  };
}

function buildDialpadTitle(meta: DialpadCallMeta): string {
  const direction = meta.direction?.toLowerCase();
  const contactName = meta.contact?.name ?? meta.contact?.phone ?? null;
  if (direction === "inbound" && contactName)
    return `Inbound call from ${contactName}`;
  if (direction === "outbound" && contactName)
    return `Outbound call to ${contactName}`;
  return "Dialpad call";
}

function coerceExternalId(value: string | number | null | undefined): string {
  if (value == null || value === "") {
    throw new Error("[composio-normalizer:dialpad] payload is missing call id");
  }
  return String(value);
}

function coerceDialpadDate(value: string | number | null | undefined): string {
  const iso = safeCoerceDialpadDate(value);
  if (!iso) {
    throw new Error(
      "[composio-normalizer:dialpad] payload is missing call.date_started",
    );
  }
  return iso;
}

function safeCoerceDialpadDate(
  value: string | number | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    const millis = value > 1e12 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
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
