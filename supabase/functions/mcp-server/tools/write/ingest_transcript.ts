import type { ConnectorRecord } from '../../../_shared/connector-pipeline.ts';
import { runPipeline } from '../../../_shared/connector-pipeline.ts';
import {
  canonicalTurnsToSegments,
  type CanonicalTranscriptTurn,
} from '../../../_shared/canonical-recording.ts';
import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import {
  applyFolderAssignment,
  applyNote,
  applySpeakerNames,
  applyTagNames,
  buildManualMcpSourceMetadata,
  formatIngestMarkdownSummary,
  normalizeIngestPayload,
  resolveTargetWorkspace,
  type IngestSpeakerInput,
  type SpeakerMatchSummary,
} from './_ingest_helpers.ts';

const MAX_TRANSCRIPT_LENGTH = 400_000;
const MAX_TITLE_LENGTH = 500;
const MAX_NOTES_LENGTH = 10_000;
const MAX_TAGS = 50;
const MAX_SPEAKERS = 100;

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeSpeakers(value: unknown): IngestSpeakerInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      name: typeof entry.name === 'string' ? entry.name : null,
      email: typeof entry.email === 'string' ? entry.email : null,
    }));
}

function parseTimestampToSeconds(value: string): number | null {
  const parts = value.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function normalizeSpeakerKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function parseTimestampedTranscriptTurns(
  transcript: string,
  speakers: IngestSpeakerInput[],
): CanonicalTranscriptTurn[] {
  const speakerEmails = new Map(
    speakers
      .filter((speaker) => speaker.name?.trim() && speaker.email?.trim())
      .map((speaker) => [
        normalizeSpeakerKey(speaker.name),
        speaker.email?.trim().toLowerCase() ?? '',
      ]),
  );
  const turns: CanonicalTranscriptTurn[] = [];
  let current: CanonicalTranscriptTurn | null = null;
  const turnPattern = /^\s*\[([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\]\s*([^:\n]{1,160}):\s*(.*)$/;

  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(turnPattern);
    if (match) {
      if (current?.text.trim()) turns.push(current);
      const speakerName = match[2].trim();
      const startSeconds = parseTimestampToSeconds(match[1]);
      current = {
        speakerName,
        speakerEmail: speakerEmails.get(normalizeSpeakerKey(speakerName)) ?? null,
        text: match[3].trim(),
        startSeconds,
        endSeconds: null,
      };
      continue;
    }

    if (current && line.trim()) {
      current.text = `${current.text}\n${line.trim()}`.trim();
    }
  }

  if (current?.text.trim()) turns.push(current);
  return turns;
}

export const ingestTranscriptTool: ToolModule = {
  definition: { name: 'ingest_transcript' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds }) {
    const explicitWorkspaceId = typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';
    const workspaceResult = await resolveTargetWorkspace({
      id,
      explicitWorkspaceId,
      tokenScope: mcpToken.scope,
      tokenWorkspaceId: mcpToken.workspace_id,
      tokenOrgId: mcpToken.org_id,
      corsHeaders,
      supabase,
      fetchOrgWorkspaceIds,
    });
    if (workspaceResult.error) return workspaceResult.error;
    const targetWorkspaceId = workspaceResult.workspaceId!;

    const normalized = normalizeIngestPayload({
      transcript: params.transcript,
      title: params.title,
      source_date: params.source_date,
      external_id: typeof params.external_id === 'string' ? params.external_id : undefined,
    });
    const tags = normalizeTags(params.tags);
    const notes = typeof params.notes === 'string' ? params.notes : '';
    const speakers = normalizeSpeakers(params.speakers);
    const folderId = typeof params.folder_id === 'string' ? params.folder_id : '';

    if (!normalized.transcript && !normalized.title) {
      return mcpError(id, -32602, 'Either transcript or title is required', corsHeaders);
    }
    if (normalized.transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return mcpError(id, -32602, `transcript exceeds ${MAX_TRANSCRIPT_LENGTH} characters`, corsHeaders);
    }
    if (normalized.title.length > MAX_TITLE_LENGTH) {
      return mcpError(id, -32602, `title exceeds ${MAX_TITLE_LENGTH} characters`, corsHeaders);
    }
    if (notes.trim().length > MAX_NOTES_LENGTH) {
      return mcpError(id, -32602, `notes exceeds ${MAX_NOTES_LENGTH} characters`, corsHeaders);
    }
    if (tags.length > MAX_TAGS) {
      return mcpError(id, -32602, `tags exceeds ${MAX_TAGS} items`, corsHeaders);
    }
    if (speakers.length > MAX_SPEAKERS) {
      return mcpError(id, -32602, `speakers exceeds ${MAX_SPEAKERS} items`, corsHeaders);
    }

    const sourceMetadata = buildManualMcpSourceMetadata({
      title: normalized.title,
      transcript: normalized.transcript,
      source_date: normalized.source_date,
      client_name: typeof params.client_name === 'string' ? params.client_name : undefined,
      provider_name: typeof params.provider_name === 'string' ? params.provider_name : undefined,
      original_url: typeof params.original_url === 'string' ? params.original_url : undefined,
      original_domain: typeof params.original_domain === 'string' ? params.original_domain : undefined,
      og_title: typeof params.og_title === 'string' ? params.og_title : undefined,
      og_description: typeof params.og_description === 'string' ? params.og_description : undefined,
      og_image: typeof params.og_image === 'string' ? params.og_image : undefined,
    });
    const transcriptTurns = parseTimestampedTranscriptTurns(normalized.transcript, speakers);
    const transcriptSegments = transcriptTurns.length > 0
      ? canonicalTurnsToSegments(transcriptTurns)
      : null;

    const record: ConnectorRecord = {
      external_id: normalized.external_id,
      source_app: 'manual-mcp-import',
      title: normalized.title,
      full_transcript: normalized.transcript,
      transcript_segments: transcriptSegments,
      recording_start_time: normalized.recording_start_time,
      source_metadata: sourceMetadata,
      workspace_id: targetWorkspaceId,
      organization_id: mcpToken.org_id ?? undefined,
    };

    const pipelineResult = await runPipeline(supabase, mcpToken.user_id, record);
    const warnings: string[] = [];
    const initialSummary = {
      workspaceId: targetWorkspaceId,
      organizationId: mcpToken.org_id,
      sourceDate: normalized.source_date,
      recordingUrl: typeof sourceMetadata.original_url === 'string' ? sourceMetadata.original_url : null,
      warnings,
      skippedDuplicate: Boolean(pipelineResult.skipped),
    };

    if (!pipelineResult.success || !pipelineResult.recordingId) {
      if (pipelineResult.skipped) {
        return mcpOk(id, formatIngestMarkdownSummary(initialSummary));
      }
      return mcpError(id, -32603, pipelineResult.error ?? 'Failed to ingest transcript', corsHeaders);
    }

    const recordingId = pipelineResult.recordingId;
    let tagsResult = { created: [], reused: [] } as { created: string[]; reused: string[] };
    let folderName: string | null = null;
    let noteLength = 0;
    let speakerSummary: SpeakerMatchSummary = {
      matched: [],
      created: [],
      unresolved: [],
      ambiguous: [],
    };

    try {
      tagsResult = await applyTagNames(supabase, mcpToken.user_id, recordingId, tags);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Failed to apply tags');
    }

    try {
      folderName = await applyFolderAssignment(supabase, mcpToken.user_id, recordingId, folderId);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Failed to apply folder assignment');
    }

    try {
      noteLength = await applyNote(
        supabase,
        mcpToken.user_id,
        targetWorkspaceId,
        recordingId,
        notes,
      );
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Failed to create note');
    }

    try {
      speakerSummary = await applySpeakerNames(
        supabase,
        mcpToken.org_id,
        recordingId,
        speakers,
      );
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Failed to upsert speakers');
    }

    const summary = formatIngestMarkdownSummary({
      ...initialSummary,
      recordingId,
      tags: tagsResult,
      folderName,
      noteLength,
      speakerSummary,
    });
    return mcpOk(id, summary);
  },
};
