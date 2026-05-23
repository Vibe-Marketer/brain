/**
 * Canonical recording-source contract.
 *
 * Every external recording vendor maps into this shape before touching the
 * database. Downstream CallVault surfaces keep reading `recordings`; only the
 * connector adapter knows the vendor payload.
 */

export interface CanonicalTranscriptTurn {
  speakerName?: string | null;
  speakerEmail?: string | null;
  text: string;
  /** Offset from recording start, in seconds. */
  startSeconds?: number | null;
  /** Offset from recording start, in seconds. */
  endSeconds?: number | null;
}

export interface CanonicalRecording {
  /** Vendor-stable identifier. Used as recordings.source_call_id. */
  externalId: string;
  /** Lowercase source identifier, e.g. fathom, zoom, fireflies. */
  sourceApp: string;
  title: string;
  /** Searchable transcript text stored directly on recordings.full_transcript. */
  fullTranscript: string;
  /** ISO datetime string. */
  recordingStartTime: string;
  /** ISO datetime string. */
  recordingEndTime?: string | null;
  /** Duration in seconds. */
  durationSeconds?: number | null;
  /** Vendor summary, if available. Stored on recordings.summary. */
  summary?: string | null;
  /** Vendor web/app URL for the source record. */
  sourceUrl?: string | null;
  /** Public/share URL if the vendor distinguishes it from sourceUrl. */
  shareUrl?: string | null;
  recordedByName?: string | null;
  recordedByEmail?: string | null;
  participantEmails?: string[] | null;
  calendarInvitees?: unknown[] | null;
  sourceMetadata?: Record<string, unknown> | null;
  rawPayload?: unknown;
}

export interface ConnectorRecordLike {
  external_id: string;
  source_app: string;
  title: string;
  full_transcript: string;
  recording_start_time: string;
  recording_end_time?: string;
  duration?: number;
  summary?: string | null;
  source_metadata: Record<string, unknown>;
  organization_id?: string;
  workspace_id?: string;
  folder_id?: string;
}

export interface CanonicalConnectorOptions {
  organizationId?: string | null;
  workspaceId?: string | null;
  folderId?: string | null;
  importSource: string;
  syncedAt?: string;
  includeRawPayload?: boolean;
}

const SOURCE_APP_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCanonicalRecording(record: CanonicalRecording): string[] {
  const errors: string[] = [];

  if (!isNonEmpty(record.externalId)) errors.push('externalId is required');
  if (!isNonEmpty(record.sourceApp)) errors.push('sourceApp is required');
  if (record.sourceApp && !SOURCE_APP_PATTERN.test(record.sourceApp)) {
    errors.push('sourceApp must be lowercase kebab-case');
  }
  if (!isNonEmpty(record.title)) errors.push('title is required');
  if (!isNonEmpty(record.fullTranscript)) errors.push('fullTranscript is required');
  if (!isValidIsoDate(record.recordingStartTime)) errors.push('recordingStartTime must be a valid date string');
  if (record.recordingEndTime && !isValidIsoDate(record.recordingEndTime)) {
    errors.push('recordingEndTime must be a valid date string when provided');
  }
  if (record.durationSeconds != null && (!Number.isFinite(record.durationSeconds) || record.durationSeconds < 0)) {
    errors.push('durationSeconds must be a non-negative finite number when provided');
  }

  return errors;
}

export function canonicalToConnectorRecord(
  record: CanonicalRecording,
  options: CanonicalConnectorOptions,
): ConnectorRecordLike {
  const errors = validateCanonicalRecording(record);
  if (errors.length > 0) {
    throw new Error(`Invalid canonical recording: ${errors.join('; ')}`);
  }

  const sourceMetadata = compactObject({
    source_app: record.sourceApp,
    source_url: record.sourceUrl ?? null,
    share_url: record.shareUrl ?? record.sourceUrl ?? null,
    recorded_by_name: record.recordedByName ?? null,
    recorded_by_email: record.recordedByEmail ?? null,
    participant_emails: normalizeEmailList(record.participantEmails),
    calendar_invitees: record.calendarInvitees ?? null,
    import_source: options.importSource,
    synced_at: options.syncedAt ?? new Date().toISOString(),
    ...(record.sourceMetadata ?? {}),
    ...(options.includeRawPayload ? { raw_payload: record.rawPayload ?? null } : {}),
  });

  return compactObject({
    external_id: record.externalId,
    source_app: record.sourceApp,
    title: record.title,
    full_transcript: record.fullTranscript,
    summary: record.summary ?? null,
    recording_start_time: new Date(record.recordingStartTime).toISOString(),
    recording_end_time: record.recordingEndTime ? new Date(record.recordingEndTime).toISOString() : undefined,
    duration: record.durationSeconds ?? undefined,
    source_metadata: sourceMetadata,
    organization_id: options.organizationId ?? undefined,
    workspace_id: options.workspaceId ?? undefined,
    folder_id: options.folderId ?? undefined,
  }) as ConnectorRecordLike;
}

export function formatCanonicalTranscript(turns: CanonicalTranscriptTurn[]): string {
  const lines: string[] = [];

  for (const turn of turns) {
    const text = turn.text?.trim();
    if (!text) continue;

    const speaker = turn.speakerName?.trim() || turn.speakerEmail?.trim() || 'Unknown';
    const timestamp = formatOffset(turn.startSeconds ?? 0);
    lines.push(`[${timestamp}] ${speaker}: ${text}`);
  }

  return lines.join('\n\n');
}

export function formatOffset(seconds: number): string {
  const totalSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function normalizeEmailList(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const email = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoDate(value: unknown): value is string {
  if (!isNonEmpty(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function compactObject<T extends Record<string, unknown>>(object: T): T {
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) compacted[key] = value;
  }
  return compacted as T;
}
