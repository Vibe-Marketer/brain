import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from "./canonical-recording.ts";

export interface ReadAiParticipant {
  name?: string | null;
  email?: string | null;
  invited?: boolean | null;
  attended?: boolean | null;
}

export interface ReadAiPerson {
  name?: string | null;
  email?: string | null;
}

export interface ReadAiTranscriptTurn {
  speaker?: ReadAiPerson | string | null;
  text?: string | null;
  start_time_ms?: number | null;
  end_time_ms?: number | null;
}

export interface ReadAiSpeakerBlock {
  speaker?: ReadAiPerson | string | null;
  speaker_name?: string | null;
  text?: string | null;
  words?: Array<{ text?: string | null }> | string | null;
  start_time?: string | number | null;
  end_time?: string | number | null;
  start_time_ms?: string | number | null;
  end_time_ms?: string | number | null;
}

export interface ReadAiTranscript {
  turns?: ReadAiTranscriptTurn[] | null;
  speaker_blocks?: ReadAiSpeakerBlock[] | null;
  text?: string | null;
}

export interface ReadAiActionItem {
  text?: string | null;
  description?: string | null;
  assignee?: ReadAiPerson | string | null;
  due_date?: string | null;
}

export interface ReadAiMeeting {
  id: string;
  start_time?: string | number | null;
  end_time?: string | number | null;
  session_id?: string | null;
  trigger?: string | null;
  request_id?: string | null;
  platform_meeting_id?: string | null;
  start_time_ms?: number | null;
  end_time_ms?: number | null;
  scheduled_start_time_ms?: number | null;
  scheduled_end_time_ms?: number | null;
  participants?: ReadAiParticipant[] | null;
  owner?: ReadAiPerson | null;
  title?: string | null;
  report_url?: string | null;
  platform?: string | null;
  platform_id?: string | null;
  folders?: string[] | null;
  live_enabled?: boolean | null;
  summary?: string | Record<string, unknown> | null;
  chapter_summaries?: unknown;
  action_items?: Array<ReadAiActionItem | string> | string | null;
  key_questions?: unknown;
  topics?: string[] | string | null;
  metrics?: Record<string, unknown> | null;
  transcript?: ReadAiTranscript | null;
  recording_download?: unknown;
}

export function readAiMeetingToCanonical(meeting: ReadAiMeeting): CanonicalRecording {
  const turns = readAiTranscriptToTurns(meeting);
  const fullTranscript = formatCanonicalTranscript(turns);
  if (!fullTranscript.trim()) {
    throw new Error(`Read.ai meeting ${meeting.id} has no transcript text`);
  }

  const recordingStartTime = coerceReadAiStartTime(meeting);
  const recordingEndTime = coerceReadAiEndTime(meeting);
  const durationSeconds = readAiDurationSeconds(meeting);
  const participantEmails = normalizeEmailList([
    meeting.owner?.email ?? "",
    ...(meeting.participants ?? []).map((participant) => participant.email ?? ""),
  ]);

  return {
    externalId: meeting.id,
    sourceApp: "read-ai",
    title: meeting.title?.trim() || `Read.ai meeting ${meeting.id}`,
    fullTranscript,
    summary: readAiSummaryMarkdown(meeting),
    recordingStartTime,
    recordingEndTime,
    durationSeconds,
    sourceUrl: meeting.report_url ?? null,
    shareUrl: meeting.report_url ?? null,
    recordedByName: meeting.owner?.name ?? null,
    recordedByEmail: meeting.owner?.email ?? null,
    participantEmails,
    calendarInvitees: meeting.participants ?? [],
    transcriptTurns: turns,
    sourceMetadata: {
      read_ai_meeting_id: meeting.id,
      read_ai_report_url: meeting.report_url ?? null,
      read_ai_platform: meeting.platform ?? null,
      read_ai_platform_id: meeting.platform_id ?? meeting.platform_meeting_id ?? null,
      read_ai_folders: meeting.folders ?? [],
      read_ai_live_enabled: Boolean(meeting.live_enabled),
      read_ai_trigger: meeting.trigger ?? null,
      read_ai_request_id: meeting.request_id ?? null,
      read_ai_action_items: normalizeActionItems(meeting.action_items),
      read_ai_topics: normalizeStringList(meeting.topics),
      read_ai_metrics: meeting.metrics ?? null,
    },
    rawPayload: meeting,
  };
}

export function readAiTranscriptToTurns(meeting: ReadAiMeeting): CanonicalTranscriptTurn[] {
  const startMs = coerceReadAiTimeMs(meeting.start_time_ms ?? meeting.start_time) ??
    meeting.scheduled_start_time_ms ??
    0;
  const apiTurns = meeting.transcript?.turns ?? [];
  if (apiTurns.length > 0) {
    return apiTurns.map((turn) => ({
      speakerName: speakerName(turn.speaker),
      speakerEmail: speakerEmail(turn.speaker),
      text: turn.text ?? "",
      startSeconds: millisOffset(turn.start_time_ms, startMs),
      endSeconds: millisOffset(turn.end_time_ms, startMs),
    })).filter((turn) => turn.text.trim().length > 0);
  }

  const speakerBlocks = meeting.transcript?.speaker_blocks ?? [];
  if (speakerBlocks.length > 0) {
    return speakerBlocks.map((block) => ({
      speakerName: block.speaker_name ?? speakerName(block.speaker),
      speakerEmail: speakerEmail(block.speaker),
      text: block.text ?? wordsText(block.words),
      startSeconds: millisOffset(
        coerceReadAiTimeMs(block.start_time_ms ?? block.start_time),
        startMs,
      ),
      endSeconds: millisOffset(
        coerceReadAiTimeMs(block.end_time_ms ?? block.end_time),
        startMs,
      ),
    })).filter((turn) => turn.text.trim().length > 0);
  }

  const text = meeting.transcript?.text?.trim();
  if (text) {
    return [{ speakerName: "Read.ai", text, startSeconds: 0, endSeconds: null }];
  }

  return [];
}

export function coerceReadAiStartTime(meeting: ReadAiMeeting): string {
  const value = coerceReadAiTimeMs(meeting.start_time_ms ?? meeting.start_time) ??
    meeting.scheduled_start_time_ms;
  if (value != null && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }
  throw new Error(`Read.ai meeting ${meeting.id} is missing a valid start_time_ms`);
}

export function coerceReadAiEndTime(meeting: ReadAiMeeting): string | null {
  const value = coerceReadAiTimeMs(meeting.end_time_ms ?? meeting.end_time);
  if (value != null && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }
  return null;
}

export function readAiDurationSeconds(meeting: ReadAiMeeting): number | null {
  const startMs = coerceReadAiTimeMs(meeting.start_time_ms ?? meeting.start_time);
  const endMs = coerceReadAiTimeMs(meeting.end_time_ms ?? meeting.end_time);
  if (
    startMs != null &&
    endMs != null &&
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    endMs >= startMs
  ) {
    return Math.round((endMs - startMs) / 1000);
  }
  return null;
}

export function readAiSummaryMarkdown(meeting: ReadAiMeeting): string | null {
  const sections = [
    stringifyUnknown(meeting.summary),
    stringifyList("Topics", normalizeStringList(meeting.topics)),
    stringifyList("Action items", normalizeActionItems(meeting.action_items)),
  ].filter((section): section is string => Boolean(section?.trim()));

  return sections.length > 0 ? sections.join("\n\n") : null;
}

function normalizeActionItems(value: ReadAiMeeting["action_items"]): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    const text = item.text ?? item.description ?? "";
    const assignee = speakerName(item.assignee);
    const suffix = [
      assignee ? `assignee: ${assignee}` : null,
      item.due_date ? `due: ${item.due_date}` : null,
    ].filter(Boolean).join(", ");
    return suffix ? `${text} (${suffix})`.trim() : text.trim();
  }).filter(Boolean);
}

function normalizeStringList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function stringifyUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
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

function speakerName(value: ReadAiPerson | string | null | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  return value?.name?.trim() || value?.email?.trim() || null;
}

function speakerEmail(value: ReadAiPerson | string | null | undefined): string | null {
  if (!value || typeof value === "string") return null;
  return value.email?.trim() || null;
}

function millisOffset(value: number | null | undefined, meetingStartMs: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!Number.isFinite(meetingStartMs) || meetingStartMs <= 0) return value / 1000;
  return Math.max(0, (value - meetingStartMs) / 1000);
}

function wordsText(words: ReadAiSpeakerBlock["words"]): string {
  if (typeof words === "string") return words.trim();
  return (words ?? []).map((word) => word.text?.trim()).filter(Boolean).join(" ");
}

function coerceReadAiTimeMs(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
