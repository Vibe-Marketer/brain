import type { SupabaseClient } from '../_types.ts';
import { mcpError } from '../../protocol.ts';

type WorkspaceScopeArgs = {
  id: string | number | null;
  explicitWorkspaceId?: string | null;
  tokenScope: 'workspace' | 'organization';
  tokenWorkspaceId: string | null;
  tokenOrgId: string | null;
  corsHeaders: Record<string, string>;
  supabase: SupabaseClient;
  fetchOrgWorkspaceIds: (
    supabase: SupabaseClient,
    orgId: string,
  ) => Promise<{ ids: string[] | null; error: boolean }>;
};

export type NormalizeIngestPayloadInput = {
  transcript?: unknown;
  title?: unknown;
  source_date?: unknown;
  external_id?: unknown;
};

export type NormalizeIngestPayloadResult = {
  transcript: string;
  title: string;
  source_date: string | null;
  recording_start_time: string;
  external_id: string;
};

export type ManualSourceMetadataInput = {
  title?: string;
  transcript?: string;
  source_date?: string | null;
  client_name?: string;
  provider_name?: string;
  original_url?: string;
  original_domain?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  extra?: Record<string, unknown>;
};

export type IngestSpeakerInput = {
  name?: string | null;
  email?: string | null;
};

export type ExistingSpeaker = {
  id: string;
  name: string | null;
  email: string | null;
};

export type SpeakerMatchSummary = {
  matched: Array<{ input: IngestSpeakerInput; speakerId: string }>;
  created: IngestSpeakerInput[];
  unresolved: IngestSpeakerInput[];
  ambiguous: Array<{ input: IngestSpeakerInput; candidates: ExistingSpeaker[] }>;
};

export async function resolveTargetWorkspace(args: WorkspaceScopeArgs): Promise<{
  workspaceId?: string;
  error?: Response;
}> {
  const explicitWorkspaceId = args.explicitWorkspaceId?.trim() ?? '';

  if (args.tokenScope === 'workspace') {
    const scopedWorkspaceId = args.tokenWorkspaceId?.trim() ?? '';
    if (!scopedWorkspaceId) {
      return { error: mcpError(args.id, -32603, 'Workspace-scoped token is missing workspace context', args.corsHeaders) };
    }
    if (explicitWorkspaceId && explicitWorkspaceId !== scopedWorkspaceId) {
      return {
        error: mcpError(
          args.id,
          -32602,
          'workspace_id does not match the workspace this token is scoped to',
          args.corsHeaders,
        ),
      };
    }
    return { workspaceId: scopedWorkspaceId };
  }

  if (!explicitWorkspaceId) {
    return {
      error: mcpError(
        args.id,
        -32602,
        'workspace_id is required for organization-scoped tokens',
        args.corsHeaders,
      ),
    };
  }

  if (!args.tokenOrgId) {
    return { error: mcpError(args.id, -32603, 'Organization-scoped token is missing organization context', args.corsHeaders) };
  }

  const { ids: orgWorkspaceIds, error: orgWsError } = await args.fetchOrgWorkspaceIds(
    args.supabase,
    args.tokenOrgId,
  );
  if (orgWsError || !orgWorkspaceIds || orgWorkspaceIds.length === 0) {
    return { error: mcpError(args.id, -32603, 'Failed to resolve organization workspaces', args.corsHeaders) };
  }
  if (!orgWorkspaceIds.includes(explicitWorkspaceId)) {
    return { error: mcpError(args.id, -32001, 'workspace_id is not in this organization', args.corsHeaders) };
  }

  return { workspaceId: explicitWorkspaceId };
}

export function normalizeIngestPayload(input: NormalizeIngestPayloadInput): NormalizeIngestPayloadResult {
  const transcript = typeof input.transcript === 'string' ? input.transcript.trim() : '';
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Untitled Manual MCP Import';
  const sourceDate =
    typeof input.source_date === 'string' && input.source_date.trim()
      ? input.source_date.trim()
      : null;
  const externalId =
    typeof input.external_id === 'string' && input.external_id.trim()
      ? input.external_id.trim()
      : crypto.randomUUID();

  return {
    transcript,
    title,
    source_date: sourceDate,
    recording_start_time: sourceDate ?? new Date().toISOString(),
    external_id: externalId,
  };
}

export function buildManualMcpSourceMetadata(input: ManualSourceMetadataInput): Record<string, unknown> {
  const transcript = input.transcript?.trim() ?? '';
  const title = input.title?.trim() ?? '';
  const isLowContext = transcript.length < 20;

  return {
    visible_source_label: 'Manual MCP Import',
    manual_mcp_import: true,
    source_type: 'manual_mcp_import',
    source_date: input.source_date ?? null,
    client_name: input.client_name ?? null,
    provider_name: input.provider_name ?? null,
    original_url: input.original_url ?? null,
    original_domain: input.original_domain ?? null,
    og_title: input.og_title ?? null,
    og_description: input.og_description ?? null,
    og_image: input.og_image ?? null,
    low_context: isLowContext,
    low_context_reason: isLowContext ? 'transcript_missing_or_minimal' : null,
    title_hint: title || null,
    ...input.extra,
  };
}

export function normalizeTagNames(tagNames: string[]): string[] {
  return Array.from(new Set(tagNames.map((name) => name.trim().toLowerCase()).filter(Boolean)));
}

export async function applyTagNames(
  supabase: SupabaseClient,
  userId: string,
  recordingId: string,
  tagNames: string[],
): Promise<{ created: string[]; reused: string[] }> {
  const normalizedNames = normalizeTagNames(tagNames);
  if (normalizedNames.length === 0) return { created: [], reused: [] };

  const { data: existingRows } = await supabase
    .from('personal_tags')
    .select('id, name')
    .eq('user_id', userId);

  const existingByLower = new Map<string, { id: string; name: string }>();
  for (const row of (existingRows ?? []) as Array<{ id: string; name: string }>) {
    existingByLower.set(row.name.trim().toLowerCase(), row);
  }

  const created: string[] = [];
  const reused: string[] = [];

  for (const normalizedName of normalizedNames) {
    let tagRow = existingByLower.get(normalizedName);
    if (!tagRow) {
      const { data: inserted, error } = await supabase
        .from('personal_tags')
        .insert({
          user_id: userId,
          name: normalizedName,
        })
        .select('id, name')
        .single();
      if (error || !inserted) {
        throw new Error(`Failed to create tag "${normalizedName}": ${error?.message ?? 'unknown error'}`);
      }
      tagRow = inserted as { id: string; name: string };
      existingByLower.set(normalizedName, tagRow);
      created.push(tagRow.name);
    } else {
      reused.push(tagRow.name);
    }

    const { error: assignmentError } = await supabase
      .from('personal_tag_recordings')
      .upsert({
        user_id: userId,
        tag_id: tagRow.id,
        recording_id: recordingId,
      }, { onConflict: 'tag_id,recording_id' });
    if (assignmentError) {
      throw new Error(`Failed to assign tag "${tagRow.name}": ${assignmentError.message}`);
    }
  }

  return { created, reused };
}

export async function applyFolderAssignment(
  supabase: SupabaseClient,
  userId: string,
  recordingId: string,
  folderId?: string,
): Promise<string | null> {
  const normalizedFolderId = folderId?.trim() ?? '';
  if (!normalizedFolderId) return null;

  const { data: folderRow } = await supabase
    .from('personal_folders')
    .select('id, name')
    .eq('id', normalizedFolderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!folderRow) throw new Error('Folder not found or not accessible');

  const { error } = await supabase
    .from('personal_folder_recordings')
    .upsert({
      user_id: userId,
      folder_id: normalizedFolderId,
      recording_id: recordingId,
    }, { onConflict: 'folder_id,recording_id' });
  if (error) throw new Error(`Failed to assign folder: ${error.message}`);

  return (folderRow as { name?: string }).name ?? normalizedFolderId;
}

export async function applyNote(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  recordingId: string,
  noteContent?: string,
): Promise<number> {
  const content = noteContent?.trim() ?? '';
  if (!content) return 0;
  const { error } = await supabase
    .from('call_notes')
    .insert({
      recording_id: recordingId,
      workspace_id: workspaceId,
      user_id: userId,
      content,
    });
  if (error) throw new Error(`Failed to create note: ${error.message}`);
  return content.length;
}

export function resolveSpeakerMatches(
  inputSpeakers: IngestSpeakerInput[],
  existingSpeakers: ExistingSpeaker[],
): SpeakerMatchSummary {
  const byEmail = new Map<string, ExistingSpeaker[]>();
  const byName = new Map<string, ExistingSpeaker[]>();

  for (const speaker of existingSpeakers) {
    const normalizedEmail = speaker.email?.trim().toLowerCase();
    if (normalizedEmail) byEmail.set(normalizedEmail, [...(byEmail.get(normalizedEmail) ?? []), speaker]);

    const normalizedName = speaker.name?.trim().toLowerCase();
    if (normalizedName) byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), speaker]);
  }

  const matched: Array<{ input: IngestSpeakerInput; speakerId: string }> = [];
  const created: IngestSpeakerInput[] = [];
  const unresolved: IngestSpeakerInput[] = [];
  const ambiguous: Array<{ input: IngestSpeakerInput; candidates: ExistingSpeaker[] }> = [];

  for (const inputSpeaker of inputSpeakers) {
    const email = inputSpeaker.email?.trim().toLowerCase() ?? '';
    const name = inputSpeaker.name?.trim().toLowerCase() ?? '';
    if (!email && !name) {
      unresolved.push(inputSpeaker);
      continue;
    }

    const emailMatches = email ? (byEmail.get(email) ?? []) : [];
    if (emailMatches.length === 1) {
      matched.push({ input: inputSpeaker, speakerId: emailMatches[0].id });
      continue;
    }
    if (emailMatches.length > 1) {
      ambiguous.push({ input: inputSpeaker, candidates: emailMatches });
      continue;
    }

    const nameMatches = name ? (byName.get(name) ?? []) : [];
    if (nameMatches.length === 1) {
      matched.push({ input: inputSpeaker, speakerId: nameMatches[0].id });
      continue;
    }
    if (nameMatches.length > 1) {
      ambiguous.push({ input: inputSpeaker, candidates: nameMatches });
      continue;
    }

    created.push({
      name: inputSpeaker.name?.trim() ?? null,
      email: inputSpeaker.email?.trim() ?? null,
    });
  }

  return { matched, created, unresolved, ambiguous };
}

export async function applySpeakerNames(
  supabase: SupabaseClient,
  organizationId: string | null,
  recordingId: string,
  inputSpeakers: IngestSpeakerInput[],
): Promise<SpeakerMatchSummary> {
  if (!organizationId || inputSpeakers.length === 0) {
    return { matched: [], created: [], unresolved: [], ambiguous: [] };
  }

  const { data: existingRows } = await supabase
    .from('call_participants')
    .select('id, name, email')
    .eq('organization_id', organizationId)
    .eq('participant_type', 'speaker');

  const summary = resolveSpeakerMatches(
    inputSpeakers,
    (existingRows ?? []) as ExistingSpeaker[],
  );

  for (const speaker of summary.created) {
    const normalizedName = speaker.name?.trim() ?? '';
    if (!normalizedName) {
      summary.unresolved.push(speaker);
      continue;
    }
    const { error } = await supabase
      .from('call_participants')
      .insert({
        recording_id: recordingId,
        organization_id: organizationId,
        name: normalizedName,
        email: speaker.email?.trim().toLowerCase() || null,
        participant_type: 'speaker',
        sources: ['mcp'],
      });
    if (error) throw new Error(`Failed to upsert speaker "${normalizedName}": ${error.message}`);
  }

  return summary;
}

export function formatIngestMarkdownSummary(input: {
  recordingId?: string;
  workspaceId: string;
  organizationId: string | null;
  sourceDate?: string | null;
  recordingUrl?: string | null;
  warnings?: string[];
  tags?: { created: string[]; reused: string[] };
  folderName?: string | null;
  noteLength?: number;
  speakerSummary?: SpeakerMatchSummary;
  skippedDuplicate?: boolean;
}): string {
  const warnings = input.warnings ?? [];
  const tags = input.tags ?? { created: [], reused: [] };
  const speakerSummary = input.speakerSummary ?? {
    matched: [],
    created: [],
    unresolved: [],
    ambiguous: [],
  };

  const lines = [
    '# Ingest Transcript Result',
    '',
    input.skippedDuplicate
      ? 'No new recording was created because this transcript appears to already exist.'
      : `Created recording: \`${input.recordingId ?? 'unknown'}\``,
    `Workspace: \`${input.workspaceId}\``,
    `Organization: \`${input.organizationId ?? 'unknown'}\``,
    `Provenance: **Manual MCP Import**`,
  ];

  if (input.recordingUrl) lines.push(`Source URL: ${input.recordingUrl}`);
  if (input.sourceDate) lines.push(`Source date: ${input.sourceDate}`);

  lines.push(
    '',
    '## Enrichment',
    `Tags created: ${tags.created.length}`,
    `Tags reused: ${tags.reused.length}`,
    `Folder assigned: ${input.folderName ?? 'none'}`,
    `Note created: ${input.noteLength && input.noteLength > 0 ? `yes (${input.noteLength} chars)` : 'no'}`,
    `Speakers matched: ${speakerSummary.matched.length}`,
    `Speakers created: ${speakerSummary.created.length}`,
    `Speakers unresolved: ${speakerSummary.unresolved.length}`,
    `Speakers ambiguous: ${speakerSummary.ambiguous.length}`,
  );

  if (speakerSummary.unresolved.length > 0 || speakerSummary.ambiguous.length > 0) {
    lines.push(
      '',
      'Clarification needed: provide speaker first/last name, email, and role/company for unresolved or ambiguous speaker entries.',
    );
  }

  if (warnings.length > 0) {
    lines.push('', '## Warnings', ...warnings.map((warning) => `- ${warning}`));
  }

  return lines.join('\n');
}
