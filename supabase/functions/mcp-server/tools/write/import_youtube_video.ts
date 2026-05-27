import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'import_youtube_video',
    description: 'Import a YouTube video as a call recording with transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        youtube_url: { type: 'string', description: 'Full YouTube video URL' },
        workspace_id: { type: 'string', description: 'Workspace UUID to import into' },
      },
      required: ['youtube_url', 'workspace_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "YouTube video imported successfully" with the new recording ID.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const youtubeUrl = typeof params.youtube_url === 'string' ? params.youtube_url.trim() : '';
const workspaceId = typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';
if (!youtubeUrl) return mcpError(id, -32602, 'youtube_url is required', corsHeaders);
if (!workspaceId) return mcpError(id, -32602, 'workspace_id is required', corsHeaders);
if (mcpToken.scope === 'workspace' && workspaceId !== mcpToken.workspace_id) {
          return mcpError(id, -32001, 'Workspace not accessible with this token', corsHeaders);
        } else if (mcpToken.scope === 'organization') {
          const { data: wsCheck } = await supabase
            .from('workspaces')
            .select('id')
            .eq('id', workspaceId)
            .eq('organization_id', mcpToken.org_id!)
            .maybeSingle();
          if (!wsCheck) return mcpError(id, -32001, 'Workspace not found in this organization', corsHeaders);
        }
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
try {
          const importResp = await fetch(`${supabaseUrl}/functions/v1/youtube-import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              youtube_url: youtubeUrl,
              workspace_id: workspaceId,
              user_id: mcpToken.user_id,
              organization_id: mcpToken.org_id,
            }),
          });

          if (!importResp.ok) {
            const errBody = await importResp.text();
            return mcpError(id, -32603, `YouTube import failed: ${errBody}`, corsHeaders);
          }

          const importResult = await importResp.json();
          return mcpOk(id, `YouTube video imported successfully${importResult.recording_id ? ` (Recording ID: ${importResult.recording_id})` : ''}`);
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
          return mcpError(id, -32603, `YouTube import failed: ${msg}`, corsHeaders);
        }
};
