/**
 * routes/contacts.ts — GET /v1/contacts handler
 *
 * Returns contacts owned by the authenticated user.
 * Contacts are user-owned in the schema so they are scoped to the token's user_id.
 *
 * Response envelope: { data: Contact[], pagination: PaginationMeta }
 *
 * Security (T-06.2-05): contacts are always filtered by user_id from the token context.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ApiTokenContext } from '../auth.ts';
import { jsonOk, jsonError, type PaginationMeta } from '../responses.ts';

export interface ContactItem {
  id: string;
  name: string | null;
  email: string;
  contact_type: string | null;
  last_seen_at: string | null;
  track_health: boolean;
}

export async function handleListContacts(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  tokenCtx: ApiTokenContext,
): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 20;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const search = url.searchParams.get('search')?.trim() ?? '';

  let query = supabase
    .from('contacts')
    .select('id, name, email, contact_type, last_seen_at, track_health')
    .eq('user_id', tokenCtx.user_id) // T-06.2-05: scope to token owner
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(limit + 1); // extra for has_more

  if (search) {
    const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
  }

  // Cursor: last_seen_at of the last item (ISO string, used for time-based keyset)
  if (cursor) {
    query = query.lt('last_seen_at', cursor);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('callvault-api contacts error:', error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to list contacts');
  }

  type ContactRow = {
    id: string;
    name: string | null;
    email: string;
    contact_type: string | null;
    last_seen_at: string | null;
    track_health: boolean;
  };

  const all = (rows ?? []) as ContactRow[];
  const has_more = all.length > limit;
  const page = has_more ? all.slice(0, limit) : all;

  const contacts: ContactItem[] = page.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    contact_type: c.contact_type,
    last_seen_at: c.last_seen_at,
    track_health: c.track_health,
  }));

  const next_cursor = has_more && page.length > 0
    ? (page[page.length - 1]?.last_seen_at ?? null)
    : null;

  const pagination: PaginationMeta = {
    count: contacts.length,
    has_more,
    next_cursor,
    limit,
  };

  return jsonOk<ContactItem>(contacts, pagination);
}
