import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'get_call_notes',
    description: 'List user-authored notes attached to a recording. Returns notes from all workspaces the token can see, newest first, including author and timestamp.',
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
        text: { type: 'string', description: 'Markdown document with recording title header and notes listed newest first, each with author display name, timestamp, and content, separated by ---.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
let wsIds: string[];
if (mcpToken.scope === 'workspace') {
          wsIds = [mcpToken.workspace_id!];
        } else {
          const { ids, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !ids) return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          wsIds = ids;
        }
if (wsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
const NOTE_LIMIT = 50;
const { data: notes, error: notesError } = await supabase
          .from('call_notes')
          .select('id, content, user_id, created_at')
          .eq('recording_id', recordingId)
          .in('workspace_id', wsIds)
          .order('created_at', { ascending: false })
          .limit(NOTE_LIMIT);
if (notesError) {
          return mcpError(id, -32603, `Failed to fetch notes: ${notesError.message}`, corsHeaders);
        }
const { data: rec } = await supabase
          .from('recordings')
          .select('title')
          .eq('id', recordingId)
          .maybeSingle();
type NoteRow = { id: string; content: string; user_id: string; created_at: string };
const noteRows = (notes ?? []) as NoteRow[];
if (noteRows.length === 0) {
          return mcpOk(id, `No notes found for: ${rec?.title || recordingId}`);
        }
const authorIds = Array.from(new Set(noteRows.map((n) => n.user_id)));
const redact = (uid: string) => `User ${uid.slice(0, 8)}`;
const authorLabel = new Map<string, string>();
const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', authorIds);
for (const p of (profiles ?? []) as { user_id: string; display_name: string | null }[]) {
          if (p.display_name && p.display_name.trim()) authorLabel.set(p.user_id, p.display_name.trim());
        }
for (const uid of authorIds) {
          if (!authorLabel.has(uid)) authorLabel.set(uid, redact(uid));
        }
return mcpOk(
          id,
          `# Notes: ${rec?.title || 'Untitled'}\n\n` +
          noteRows
            .map((n) => `## ${authorLabel.get(n.user_id) || redact(n.user_id)} — ${n.created_at}\n${n.content}`)
            .join('\n\n---\n\n'),
        );
};
