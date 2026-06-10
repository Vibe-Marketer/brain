import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from "./canonical-recording.ts";

export interface GrainParticipant {
  id?: string | null;
  name?: string | null;
  scope?: string | null;
  email?: string | null;
  confirmed_attendee?: boolean | null;
}

export interface GrainTeam {
  id?: string | null;
  name?: string | null;
}

export interface GrainMeetingType {
  id?: string | null;
  name?: string | null;
  scope?: string | null;
}

export interface GrainTranscriptSegment {
  participant_id?: string | null;
  speaker?: string | null;
  start?: number | null;
  end?: number | null;
  text?: string | null;
}

export interface GrainRecording {
  id: string;
  title?: string | null;
  source?: string | null;
  url?: string | null;
  media_type?: string | null;
  tags?: string[] | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  duration_ms?: number | null;
  thumbnail_url?: string | null;
  participants?: GrainParticipant[] | null;
  teams?: GrainTeam[] | null;
  meeting_type?: GrainMeetingType | null;
  ai_summary?: unknown;
  ai_action_items?: unknown;
  private_notes?: unknown;
  calendar_event?: unknown;
  transcript?: GrainTranscriptSegment[] | null;
}

export function grainRecordingToCanonical(recording: GrainRecording): CanonicalRecording {
  const turns = grainTranscriptToTurns(recording);
  const fullTranscript = formatCanonicalTranscript(turns);
  if (!fullTranscript.trim()) {
    throw new Error(`Grain recording ${recording.id} has no transcript text`);
  }

  const recordingStartTime = coerceGrainStartTime(recording);
  const participantEmails = normalizeEmailList((recording.participants ?? []).map((participant) => participant.email ?? ""));

  return {
    externalId: recording.id,
    sourceApp: "grain",
    title: recording.title?.trim() || `Grain recording ${recording.id}`,
    fullTranscript,
    summary: grainSummaryMarkdown(recording),
    recordingStartTime,
    recordingEndTime: coerceIso(recording.end_datetime),
    durationSeconds: grainDurationSeconds(recording),
    sourceUrl: recording.url ?? null,
    shareUrl: recording.url ?? null,
    participantEmails,
    calendarInvitees: recording.participants ?? [],
    transcriptTurns: turns,
    sourceMetadata: {
      grain_recording_id: recording.id,
      grain_source: recording.source ?? null,
      grain_media_type: recording.media_type ?? null,
      grain_tags: recording.tags ?? [],
      grain_teams: recording.teams ?? [],
      grain_meeting_type: recording.meeting_type ?? null,
      grain_thumbnail_url: recording.thumbnail_url ?? null,
      grain_ai_action_items: normalizeUnknownList(recording.ai_action_items),
    },
    rawPayload: recording,
  };
}

export function grainTranscriptToTurns(recording: GrainRecording): CanonicalTranscriptTurn[] {
  const participantsById = new Map(
    (recording.participants ?? [])
      .filter((participant) => participant.id?.trim())
      .map((participant) => [participant.id?.trim() ?? "", participant]),
  );

  return (recording.transcript ?? []).map((segment) => ({
    speakerName: segment.speaker?.trim() || null,
    speakerEmail: segment.participant_id
      ? participantsById.get(segment.participant_id.trim())?.email?.trim() ?? null
      : null,
    providerSpeakerId: segment.participant_id?.trim() || null,
    text: segment.text ?? "",
    startSeconds: millisToSeconds(segment.start),
    endSeconds: millisToSeconds(segment.end),
  })).filter((turn) => turn.text.trim().length > 0);
}

export function coerceGrainStartTime(recording: GrainRecording): string {
  const start = coerceIso(recording.start_datetime);
  if (!start) throw new Error(`Grain recording ${recording.id} is missing a valid start_datetime`);
  return start;
}

export function grainDurationSeconds(recording: GrainRecording): number | null {
  if (recording.duration_ms != null && Number.isFinite(recording.duration_ms) && recording.duration_ms >= 0) {
    return Math.round(recording.duration_ms / 1000);
  }
  const start = recording.start_datetime ? Date.parse(recording.start_datetime) : NaN;
  const end = recording.end_datetime ? Date.parse(recording.end_datetime) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return Math.round((end - start) / 1000);
  }
  return null;
}

export function grainSummaryMarkdown(recording: GrainRecording): string | null {
  const sections = [
    stringifyUnknown(recording.ai_summary),
    stringifyList("Action items", normalizeUnknownList(recording.ai_action_items)),
    stringifyUnknown(recording.private_notes),
  ].filter((section): section is string => Boolean(section?.trim()));
  return sections.length > 0 ? sections.join("\n\n") : null;
}

function coerceIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function millisToSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, value / 1000);
}

function normalizeUnknownList(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return [record.text, record.description, record.title, record.summary]
        .find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined ?? "";
    }
    return "";
  }).map((item) => item.trim()).filter(Boolean);
}

function stringifyUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return stringifyList("Summary", normalizeUnknownList(value));
  if (typeof value === "object") {
    const direct = ["text", "summary", "overview"]
      .map((key) => (value as Record<string, unknown>)[key])
      .find((candidate) => typeof candidate === "string" && candidate.trim());
    if (typeof direct === "string") return direct.trim();
  }
  return null;
}

function stringifyList(label: string, items: string[]): string | null {
  return items.length > 0 ? `${label}:\n${items.map((item) => `- ${item}`).join("\n")}` : null;
}
