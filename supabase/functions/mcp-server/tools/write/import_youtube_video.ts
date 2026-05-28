import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const importYoutubeVideoTool: ToolModule = {
  definition: { name: 'import_youtube_video' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
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
  },
};
