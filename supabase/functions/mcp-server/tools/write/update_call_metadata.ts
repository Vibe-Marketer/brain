import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { resolveTargetWorkspace, verifyRecordingInWorkspace } from './_ingest_helpers.ts';

const MAX_TEXT_LEN = 10_000;
const MAX_METADATA_KEYS = 100;

function asTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const updateCallMetadataTool: ToolModule = {
  definition: { name: 'update_call_metadata' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, corsHeaders, mcpToken, fetchOrgWorkspaceIds } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    const explicitWorkspaceId = typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

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

    const accessError = await verifyRecordingInWorkspace(
      supabase,
      id,
      recordingId,
      workspaceResult.workspaceId!,
      corsHeaders,
    );
    if (accessError) return accessError;

    const incomingSourceMetadataRaw = params.source_metadata ?? params.metadata;
    const incomingSourceMetadata =
      incomingSourceMetadataRaw && typeof incomingSourceMetadataRaw === 'object' &&
        !Array.isArray(incomingSourceMetadataRaw)
        ? incomingSourceMetadataRaw as Record<string, unknown>
        : null;

    if (incomingSourceMetadataRaw != null && !incomingSourceMetadata) {
      return mcpError(id, -32602, 'source_metadata (or metadata) must be an object', corsHeaders);
    }
    if (incomingSourceMetadata && Object.keys(incomingSourceMetadata).length > MAX_METADATA_KEYS) {
      return mcpError(id, -32602, `source_metadata exceeds ${MAX_METADATA_KEYS} keys`, corsHeaders);
    }

    const title = asTrimmed(params.title);
    const summary = asTrimmed(params.summary);
    const sourceDate = asTrimmed(params.source_date);
    const recordingStartTime = asTrimmed(params.recording_start_time);
    const durationRaw = params.duration;
    const duration =
      typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw >= 0
        ? Math.round(durationRaw)
        : null;

    if (title && title.length > MAX_TEXT_LEN) return mcpError(id, -32602, 'title exceeds 10,000 characters', corsHeaders);
    if (summary && summary.length > MAX_TEXT_LEN) return mcpError(id, -32602, 'summary exceeds 10,000 characters', corsHeaders);
    if (durationRaw != null && duration === null) {
      return mcpError(id, -32602, 'duration must be a non-negative number', corsHeaders);
    }

    const hasAnyChange = Boolean(
      title || summary || sourceDate || recordingStartTime || durationRaw != null || incomingSourceMetadata,
    );
    if (!hasAnyChange) {
      return mcpError(id, -32602, 'Provide at least one metadata field to update', corsHeaders);
    }

    const { data: existing, error: fetchError } = await supabase
      .from('recordings')
      .select('title, source_metadata')
      .eq('id', recordingId)
      .maybeSingle();
    if (fetchError || !existing) {
      return mcpError(id, -32603, 'Failed to load recording before metadata update', corsHeaders);
    }

    const existingSourceMetadata =
      existing.source_metadata && typeof existing.source_metadata === 'object' &&
        !Array.isArray(existing.source_metadata)
        ? existing.source_metadata as Record<string, unknown>
        : {};
    const mergedSourceMetadata = incomingSourceMetadata
      ? { ...existingSourceMetadata, ...incomingSourceMetadata }
      : existingSourceMetadata;

    // Preserve Manual MCP Import identity when already present.
    if (existingSourceMetadata.manual_mcp_import === true) {
      mergedSourceMetadata.manual_mcp_import = true;
      mergedSourceMetadata.visible_source_label = existingSourceMetadata.visible_source_label ?? 'Manual MCP Import';
      mergedSourceMetadata.source_type = existingSourceMetadata.source_type ?? 'manual_mcp_import';
    }
    if (sourceDate) {
      mergedSourceMetadata.source_date = sourceDate;
    }

    const updatePayload: Record<string, unknown> = {
      source_metadata: mergedSourceMetadata,
    };
    const changedFields: string[] = ['source_metadata'];

    if (title) {
      updatePayload.title = title;
      changedFields.push('title');
    }
    if (summary) {
      updatePayload.summary = summary;
      changedFields.push('summary');
    }
    if (recordingStartTime) {
      updatePayload.recording_start_time = recordingStartTime;
      changedFields.push('recording_start_time');
    } else if (sourceDate) {
      updatePayload.recording_start_time = sourceDate;
      changedFields.push('recording_start_time');
    }
    if (duration != null) {
      updatePayload.duration = duration;
      changedFields.push('duration');
    }

    const { error: updateError } = await supabase
      .from('recordings')
      .update(updatePayload)
      .eq('id', recordingId);

    if (updateError) {
      console.error('mcp-server update_call_metadata error:', updateError);
      return mcpError(id, -32603, `Failed to update metadata: ${updateError.message}`, corsHeaders);
    }

    return mcpOk(
      id,
      [
        '# Call Metadata Updated',
        '',
        `Recording: \`${recordingId}\``,
        `Title: ${title ?? existing.title ?? 'Untitled'}`,
        `Changed fields: ${changedFields.join(', ')}`,
      ].join('\n'),
    );
  },
};
