import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'get_contact',
    description: 'Get a contact\'s details including their recent call history.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact UUID' },
      },
      required: ['contact_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with sections: Details (email, type, last seen, created, health tracking, tags, notes) and Recent Calls (recording IDs with dates).' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const contactId = typeof params.contact_id === 'string' ? params.contact_id.trim() : '';
if (!contactId) return mcpError(id, -32602, 'contact_id is required', corsHeaders);
const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('id, name, email, contact_type, last_seen_at, track_health, health_alert_threshold_days, notes, tags, created_at')
          .eq('id', contactId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
if (contactError || !contact) {
          return mcpError(id, -32001, 'Contact not found or not accessible', corsHeaders);
        }
const { data: appearances } = await supabase
          .from('contact_call_appearances')
          .select('recording_id, appeared_at')
          .eq('contact_id', contactId)
          .eq('user_id', mcpToken.user_id)
          .order('appeared_at', { ascending: false })
          .limit(10);
const lastSeen = contact.last_seen_at
          ? new Date(contact.last_seen_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Never';
const created = new Date(contact.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const callCount = appearances?.length ?? 0;
const context = [
          `# Contact: ${contact.name || contact.email}`,
          ``,
          `## Details`,
          `- **Email**: ${contact.email}`,
          `- **Type**: ${contact.contact_type || 'other'}`,
          `- **Last seen**: ${lastSeen}`,
          `- **Created**: ${created}`,
          `- **Health tracking**: ${contact.track_health ? 'Enabled' : 'Disabled'}`,
          contact.health_alert_threshold_days ? `- **Alert threshold**: ${contact.health_alert_threshold_days} days` : '',
          contact.tags && contact.tags.length > 0 ? `- **Tags**: ${contact.tags.join(', ')}` : '',
          contact.notes ? `\n## Notes\n${contact.notes}` : '',
          ``,
          `## Recent Calls (${callCount})`,
          callCount > 0
            ? (appearances ?? []).map((a: { recording_id: string; appeared_at: string | null }) => {
                const date = a.appeared_at ? new Date(a.appeared_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown';
                return `  - Recording ${a.recording_id} (${date})`;
              }).join('\n')
            : '  No call history found.',
        ].filter(Boolean).join('\n');
return mcpOk(id, context);
};
