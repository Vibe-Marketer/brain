/**
 * Composio Gong normalizer — @composio-unverified
 *
 * Maps a Gong call + transcript payload (as returned by Composio's
 * GONG_GET_CALL / GONG_GET_TRANSCRIPT tools) into the canonical recording
 * shape. Gong has zero triggers in Composio's catalog, so this normalizer
 * is always invoked from a polling sync — not a webhook delivery.
 *
 * Status: SCAFFOLD. The exact response shape of Composio's Gong tools
 * varies by toolkit version. Field names below reflect Gong's documented
 * REST schema (calls v2 endpoint). Verify against a real Composio
 * Gong response before relying on this in production.
 *
 * GOTCHA per ADR-006: Gong has a deprecated transcript endpoint. The
 * current path is `/v2/calls/transcript`. Composio's `GONG_GET_TRANSCRIPT`
 * tool should already point at v2, but confirm before adoption.
 */

import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from "../canonical-recording.ts";

export interface GongCallPayload {
  metaData?: {
    id?: string | null;
    title?: string | null;
    scheduled?: string | null;
    started?: string | null;
    duration?: number | null;
    url?: string | null;
    primaryUserId?: string | null;
    direction?: string | null;
    media?: string | null;
  };
  parties?: GongParty[] | null;
  transcript?: GongTranscriptTurn[] | null;
  /** Composio echoes back the connected_account_id on tool responses too. */
  connected_account_id?: string | null;
}

export interface GongParty {
  id?: string | null;
  emailAddress?: string | null;
  name?: string | null;
  speakerId?: string | null;
  userId?: string | null;
  affiliation?: "Internal" | "External" | "Unknown" | null;
}

export interface GongTranscriptTurn {
  speakerId?: string | null;
  topic?: string | null;
  sentences?: GongSentence[] | null;
}

export interface GongSentence {
  start?: number | null;
  end?: number | null;
  text?: string | null;
}

export function gongCallToCanonical(
  payload: GongCallPayload,
): CanonicalRecording {
  const meta = payload.metaData ?? {};
  if (!meta.id) {
    throw new Error(
      "[composio-normalizer:gong] payload is missing metaData.id",
    );
  }

  const speakerLookup = buildSpeakerLookup(payload.parties ?? []);
  const turns = flattenGongTurns(payload.transcript ?? [], speakerLookup);
  const fullTranscript = formatCanonicalTranscript(turns);

  const startTime = coerceGongDate(meta.started ?? meta.scheduled);
  const durationSeconds = normalizeDurationSeconds(meta.duration);
  const endTime =
    durationSeconds != null
      ? new Date(
          new Date(startTime).getTime() + durationSeconds * 1000,
        ).toISOString()
      : null;

  const primaryParty =
    (payload.parties ?? []).find((party) => party.id === meta.primaryUserId) ??
    (payload.parties ?? [])[0] ??
    null;

  const participantEmails = normalizeEmailList(
    (payload.parties ?? [])
      .map((party) => party.emailAddress)
      .filter((email): email is string => typeof email === "string"),
  );

  return {
    externalId: String(meta.id),
    sourceApp: "gong",
    title: meta.title?.trim() || "Untitled Gong Call",
    fullTranscript,
    recordingStartTime: startTime,
    recordingEndTime: endTime,
    durationSeconds,
    sourceUrl: meta.url ?? null,
    shareUrl: meta.url ?? null,
    recordedByEmail: primaryParty?.emailAddress ?? null,
    recordedByName: primaryParty?.name ?? null,
    participantEmails,
    calendarInvitees: payload.parties ?? [],
    sourceMetadata: {
      gong_call_id: meta.id,
      gong_url: meta.url ?? null,
      gong_direction: meta.direction ?? null,
      gong_media: meta.media ?? null,
      composio_connected_account_id: payload.connected_account_id ?? null,
      composio_routed: true,
    },
    rawPayload: payload,
  };
}

function buildSpeakerLookup(parties: GongParty[]): Map<string, GongParty> {
  const lookup = new Map<string, GongParty>();
  for (const party of parties) {
    if (party.speakerId) lookup.set(party.speakerId, party);
    if (party.id) lookup.set(party.id, party);
  }
  return lookup;
}

function flattenGongTurns(
  transcript: GongTranscriptTurn[],
  speakerLookup: Map<string, GongParty>,
): CanonicalTranscriptTurn[] {
  const turns: CanonicalTranscriptTurn[] = [];

  for (const block of transcript) {
    const party = block.speakerId ? speakerLookup.get(block.speakerId) : null;
    for (const sentence of block.sentences ?? []) {
      const text = sentence.text?.trim();
      if (!text) continue;
      turns.push({
        speakerName: party?.name ?? "Unknown",
        speakerEmail: party?.emailAddress ?? null,
        text,
        startSeconds: sentence.start != null ? sentence.start / 1000 : null,
        endSeconds: sentence.end != null ? sentence.end / 1000 : null,
      });
    }
  }

  return turns;
}

function coerceGongDate(value: string | null | undefined): string {
  if (!value) {
    throw new Error(
      "[composio-normalizer:gong] payload is missing metaData.started/scheduled",
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `[composio-normalizer:gong] could not parse date: ${value}`,
    );
  }
  return new Date(parsed).toISOString();
}

function normalizeDurationSeconds(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}
