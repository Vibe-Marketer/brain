import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const getFolderCallsTool: ToolModule = {
  definition: { name: 'get_folder_calls' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
    if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

    const { data: folderCheck } = await supabase
      .from('personal_folders')
      .select('id, name')
      .eq('id', folderId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();

    if (!folderCheck) {
      return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);
    }

    const { data: folderRecs, error: frError } = await supabase
      .from('personal_folder_recordings')
      .select('recording_id, recordings(id, title, recording_start_time, duration, summary)')
      .eq('folder_id', folderId)
      .eq('user_id', mcpToken.user_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (frError) {
      return mcpError(id, -32603, `Failed to fetch folder calls: ${frError.message}`, corsHeaders);
    }

    if (!folderRecs || folderRecs.length === 0) {
      return mcpOk(id, `No calls found in folder "${folderCheck.name}".`);
    }

    type FolderRecRow = {
      recording_id: string;
      recordings: {
        id: string;
        title: string | null;
        recording_start_time: string | null;
        duration: number | null;
        summary: string | null;
      } | null;
    };

    return mcpOk(
      id,
      `# Folder: ${folderCheck.name}\n\n` +
        ((folderRecs ?? []) as unknown as FolderRecRow[])
          .filter((fr) => fr.recordings)
          .map((fr) => {
            const r = fr.recordings!;
            const date = r.recording_start_time
              ? new Date(r.recording_start_time).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Unknown date';
            const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
            return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
          })
          .join('\n\n---\n\n'),
    );
  },
};
