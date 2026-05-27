import { enforceMcpAiUsage } from "../../../_shared/track-ai-usage-inline.ts";

import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject, generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

export const schema = {
    name: 'get_action_items',
    description: 'Get AI-extracted action items from a call recording. Parses the summary and source metadata for action items, decisions, and follow-ups.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with title header and numbered action items extracted from source metadata, plus the summary section if available.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }
const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, summary, source_metadata')
          .eq('id', recordingId)
          .maybeSingle();
if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }
const meta = recording.source_metadata as Record<string, unknown> | null;
const metaActionItems = meta?.action_items as string[] | undefined;
const sections: string[] = [`# Action Items: ${recording.title || 'Untitled'}`];
if (metaActionItems && metaActionItems.length > 0) {
          sections.push('', '## Extracted Action Items');
          metaActionItems.forEach((item: string, i: number) => {
            sections.push(`${i + 1}. ${item}`);
          });
        }
if (recording.summary) {
          sections.push('', '## Summary (may contain additional action items)');
          sections.push(recording.summary);
        }
if (!metaActionItems?.length && !recording.summary) {
          sections.push('', 'No action items or summary available for this recording.');
        }
return mcpOk(id, sections.join('\n'));
};
