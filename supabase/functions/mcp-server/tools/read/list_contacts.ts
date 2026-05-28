import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const listContactsTool: ToolModule = {
  definition: { name: 'list_contacts' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
    const search = typeof params.search === 'string' ? params.search.trim() : '';

    let query = supabase
      .from('contacts')
      .select('id, name, email, contact_type, last_seen_at, track_health, notes')
      .eq('user_id', mcpToken.user_id)
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (search) {
      const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
    }

    const { data: contacts, error: contactsError } = await query;

    if (contactsError) {
      return mcpError(id, -32603, `Failed to list contacts: ${contactsError.message}`, corsHeaders);
    }

    if (!contacts || contacts.length === 0) {
      return mcpOk(id, search ? `No contacts found matching "${search}".` : 'No contacts found.');
    }

    type ContactRow = {
      id: string;
      name: string | null;
      email: string;
      contact_type: string | null;
      last_seen_at: string | null;
      track_health: boolean;
      notes: string | null;
    };

    return mcpOk(
      id,
      (contacts as ContactRow[])
        .map((c) => {
          const lastSeen = c.last_seen_at
            ? new Date(c.last_seen_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'Never';
          return `ID: ${c.id}\nName: ${c.name || 'Unknown'}\nEmail: ${c.email}\nType: ${c.contact_type || 'other'}\nLast seen: ${lastSeen}${c.notes ? `\nNotes: ${c.notes}` : ''}`;
        })
        .join('\n\n---\n\n'),
    );
  },
};
