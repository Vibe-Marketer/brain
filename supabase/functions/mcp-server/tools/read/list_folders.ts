import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'list_folders',
    description: 'List personal folders accessible in the org/workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of folders with ID and name for each, separated by ---.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;
let query = supabase
          .from('personal_folders')
          .select('id, name, created_at, organization_id')
          .eq('user_id', mcpToken.user_id)
          .order('name')
          .limit(limit);
if (mcpToken.scope === 'workspace') {
          // For workspace-scoped, filter by the org that owns the workspace
          const { data: ws } = await supabase
            .from('workspaces')
            .select('organization_id')
            .eq('id', mcpToken.workspace_id!)
            .maybeSingle();
          if (ws) query = query.eq('organization_id', ws.organization_id);
        } else if (mcpToken.org_id) {
          query = query.eq('organization_id', mcpToken.org_id);
        }
const { data: folders, error: foldersError } = await query;
if (foldersError) {
          return mcpError(id, -32603, `Failed to list folders: ${foldersError.message}`, corsHeaders);
        }
if (!folders || folders.length === 0) {
          return mcpOk(id, 'No folders found.');
        }
type FolderRow = { id: string; name: string; created_at: string };
return mcpOk(
          id,
          (folders as FolderRow[])
            .map((f) => `ID: ${f.id}\nName: ${f.name}`)
            .join('\n\n---\n\n'),
        );
};
