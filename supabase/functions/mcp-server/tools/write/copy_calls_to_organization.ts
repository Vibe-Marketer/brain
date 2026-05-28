import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const copyCallsToOrganizationTool: ToolModule = {
  definition: { name: 'copy_calls_to_organization' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const recordingIds = Array.isArray(params.recording_ids) ? params.recording_ids as string[] : [];
    const targetOrgId = typeof params.target_org_id === 'string' ? params.target_org_id.trim() : '';
    if (recordingIds.length === 0) return mcpError(id, -32602, 'recording_ids is required (non-empty array)', corsHeaders);
    if (!targetOrgId) return mcpError(id, -32602, 'target_org_id is required', corsHeaders);

    const { data: targetMembership } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', targetOrgId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();

    if (!targetMembership) {
      return mcpError(id, -32001, 'You do not have access to the target organization', corsHeaders);
    }

    let copied = 0;
    const errors: string[] = [];
    for (const recId of recordingIds) {
      const { data: newId, error: copyErr } = await supabase
        .rpc('copy_recording_to_organization', {
          p_recording_id: recId,
          p_target_org_id: targetOrgId,
        });

      if (copyErr) {
        errors.push(`${recId}: ${copyErr.message}`);
      } else if (newId) {
        copied++;
      }
    }

    const msg = `Copied ${copied} of ${recordingIds.length} call(s) to target organization`;
    if (errors.length > 0) {
      return mcpOk(id, `${msg}\n\nErrors:\n${errors.join('\n')}`);
    }
    return mcpOk(id, msg);
  },
};
