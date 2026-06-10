import {
  formatCanonicalTranscript,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from './canonical-recording.ts';
import type { PlaudFile, PlaudNoteItem, PlaudSourceItem, PlaudTranscriptSegment } from './plaud-client.ts';

export function plaudFileToCanonical(file: PlaudFile): CanonicalRecording {
  const turns = plaudTranscriptTurns(file);
  const fullTranscript = formatCanonicalTranscript(turns);
  const startTime = coercePlaudDate(file);
  const durationSeconds = normalizeDurationSeconds(file.duration);
  const recordingEndTime = coercePlaudEndTime(file, startTime, durationSeconds);
  const summary = plaudSummaryMarkdown(file);
  const apiShape = isConsumerPlaudFile(file) ? 'consumer' : 'developer';

  return {
    externalId: file.id,
    sourceApp: 'plaud',
    title: file.name?.trim() || file.filename?.trim() || `Plaud recording ${file.id}`,
    fullTranscript,
    summary,
    recordingStartTime: startTime,
    recordingEndTime,
    durationSeconds,
    sourceUrl: null,
    shareUrl: null,
    participantEmails: [],
    calendarInvitees: [],
    transcriptTurns: turns,
    sourceMetadata: {
      external_id: file.id,
      plaud_file_id: file.id,
      plaud_api_shape: apiShape,
      plaud_serial_number: file.serial_number ?? null,
      plaud_audio_available: Boolean(file.presigned_url),
      plaud_transcript_available: turns.length > 0,
      plaud_summary_available: Boolean(summary),
      plaud_presigned_audio_url: file.presigned_url ?? null,
      plaud_source_item_ids: (file.source_list ?? []).map((item) => item.id).filter(Boolean),
      plaud_note_item_ids: (file.note_list ?? []).map((item) => item.id).filter(Boolean),
      plaud_file_md5: file.file_md5 ?? null,
      plaud_version_ms: file.version_ms ?? null,
      plaud_is_trans: file.is_trans ?? null,
      plaud_is_summary: file.is_summary ?? null,
      transcript_speaker_names: extractSpeakerNames(turns),
    },
    rawPayload: file,
  };
}

export function plaudTranscriptTurns(file: PlaudFile | PlaudSourceItem[]): CanonicalTranscriptTurn[] {
  const sourceList = Array.isArray(file) ? file : file.source_list ?? [];
  const legacyTurns = transcriptTurnsFromSourceList(sourceList);
  if (legacyTurns.length > 0) return legacyTurns;

  const consumerSegments = Array.isArray(file) ? [] : file.trans_result ?? [];
  return transcriptTurnsFromSegments(consumerSegments);
}

export function plaudSummaryMarkdown(fileOrNoteList: PlaudFile | PlaudNoteItem[]): string | null {
  const noteList = Array.isArray(fileOrNoteList) ? fileOrNoteList : fileOrNoteList.note_list ?? [];
  const note = noteList.find((item) => item.data_type === 'auto_sum_note' && item.data_content?.trim());
  if (note?.data_content?.trim()) return note.data_content.trim();

  if (Array.isArray(fileOrNoteList)) return null;

  const aiContent = parsePlaudAiContent(fileOrNoteList.ai_content);
  if (aiContent) return aiContent;

  const summaryList = fileOrNoteList.summary_list ?? [];
  const firstSummary = summaryList.find((item) => typeof item === 'string' && item.trim());
  return typeof firstSummary === 'string' ? firstSummary.trim() : null;
}

function transcriptTurnsFromSourceList(sourceList: PlaudSourceItem[]): CanonicalTranscriptTurn[] {
  const transcriptSource = sourceList.find((source) => source.data_type === 'transaction' && source.data_content);
  if (!transcriptSource?.data_content) return [];

  const parsed = parsePlaudJson<unknown>(transcriptSource.data_content, []);
  if (!Array.isArray(parsed)) return [];

  return transcriptTurnsFromSegments(parsed as PlaudTranscriptSegment[]);
}

function transcriptTurnsFromSegments(segments: PlaudTranscriptSegment[]): CanonicalTranscriptTurn[] {
  return segments
    .map((segment): CanonicalTranscriptTurn => ({
      speakerName: segment.speaker ?? segment.speaker_name ?? 'Unknown',
      text: segment.content ?? segment.text ?? '',
      startSeconds: millisToSeconds(segment.start_time),
      endSeconds: millisToSeconds(segment.end_time),
    }))
    .filter((turn) => turn.text.trim().length > 0);
}

function extractSpeakerNames(turns: CanonicalTranscriptTurn[]): string[] {
  const seen = new Set<string>();
  const speakers: string[] = [];

  for (const turn of turns) {
    const speaker = turn.speakerName?.trim();
    if (!speaker || speaker.toLowerCase() === 'unknown') continue;
    const key = speaker.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    speakers.push(speaker);
  }

  return speakers;
}

function parsePlaudAiContent(value: unknown): string | null {
  if (!value) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{')) return trimmed;

  const parsed = parsePlaudJson<Record<string, unknown> | null>(trimmed, null);
  if (!parsed || typeof parsed !== 'object') return trimmed;

  if (typeof parsed.markdown === 'string' && parsed.markdown.trim()) {
    return parsed.markdown.trim();
  }

  const content = parsed.content;
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const contentMarkdown = (content as Record<string, unknown>).markdown;
    if (typeof contentMarkdown === 'string' && contentMarkdown.trim()) {
      return contentMarkdown.trim();
    }
  }

  if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
    return parsed.summary.trim();
  }

  return trimmed;
}

function coercePlaudDate(file: PlaudFile): string {
  const stringCandidates = [file.start_at, typeof file.created_at === 'string' ? file.created_at : null];
  for (const candidate of stringCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    }
  }

  const numericCandidates = [file.start_time, typeof file.created_at === 'number' ? file.created_at : null];
  for (const candidate of numericCandidates) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) {
      return new Date(candidate).toISOString();
    }
  }

  throw new Error('Plaud file is missing a valid start time');
}

function coercePlaudEndTime(file: PlaudFile, startTime: string, durationSeconds: number | null): string | null {
  if (file.end_time != null && Number.isFinite(file.end_time) && file.end_time > 0) {
    return new Date(file.end_time).toISOString();
  }
  if (durationSeconds == null) return null;
  return new Date(new Date(startTime).getTime() + durationSeconds * 1000).toISOString();
}

function isConsumerPlaudFile(file: PlaudFile): boolean {
  return Array.isArray(file.trans_result)
    || typeof file.ai_content !== 'undefined'
    || typeof file.filename === 'string'
    || typeof file.start_time === 'number';
}

function normalizeDurationSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value / 1000);
}

function millisToSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value / 1000;
}

function parsePlaudJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
