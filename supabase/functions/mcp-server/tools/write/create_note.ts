import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'create_note',
    description: 'Attach a note to a call recording. Returns a confirmation string with the recording title and note length.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID to attach the note to' },
        content: { type: 'string', description: 'Note content (max 10,000 characters; trimmed; must be non-empty)' },
        workspace_id: { type: 'string', description: 'Workspace UUID. Required when called by an organization-scoped token; ignored when called by a workspace-scoped token (auto-resolved).' },
      },
      required: ['recording_id', 'content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created note on <title> (<N> chars)".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
const rawContent = typeof params.content === 'string' ? params.content : '';
const content = rawContent.trim();
const explicitWorkspaceId =
          typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';
if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
if (!content) return mcpError(id, -32602, 'content is required and cannot be empty', corsHeaders);
if (content.length > 10_000) {
          return mcpError(id, -32602, 'content exceeds 10,000 character limit', corsHeaders);
        }
let targetWorkspaceId: string;
if (mcpToken.scope === 'workspace') {
          // Workspace-scoped tokens auto-resolve; explicit workspace_id is ignored
          // (per D-11) — but if supplied, it must match for clarity.
          targetWorkspaceId = mcpToken.workspace_id!;
          if (explicitWorkspaceId && explicitWorkspaceId !== targetWorkspaceId) {
            return mcpError(
              id,
              -32602,
              'workspace_id does not match the workspace this token is scoped to',
              corsHeaders,
            );
          }
        } else {
          // Org-scoped tokens MUST supply workspace_id (per D-11) and it must be in the org.
          if (!explicitWorkspaceId) {
            return mcpError(
              id,
              -32602,
              'workspace_id is required for organization-scoped tokens',
              corsHeaders,
            );
          }
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(
            supabase,
            mcpToken.org_id!,
          );
          if (wsErr || !orgWsIds || orgWsIds.length === 0) {
            return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          }
          if (!orgWsIds.includes(explicitWorkspaceId)) {
            return mcpError(id, -32001, 'workspace_id is not in this organization', corsHeaders);
          }
          targetWorkspaceId = explicitWorkspaceId;
        }
const { data: entry } = await supabase
          .from('workspace_entries')
          .select('recording_id')
          .eq('recording_id', recordingId)
          .eq('workspace_id', targetWorkspaceId)
          .maybeSingle();
if (!entry) {
          return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }
const { error: insertError } = await supabase
          .from('call_notes')
          .insert({
            recording_id: recordingId,
            workspace_id: targetWorkspaceId,
            user_id: mcpToken.user_id,
            content,
          });
if (insertError) {
          console.error('mcp-server create_note error:', insertError);
          return mcpError(id, -32603, `Failed to create note: ${insertError.message}`, corsHeaders);
        }
const { data: rec } = await supabase
          .from('recordings')
          .select('title')
          .eq('id', recordingId)
          .maybeSingle();
return mcpOk(
          id,
          `Created note on "${rec?.title || 'Untitled'}" (${content.length} chars)`,
        );
};
