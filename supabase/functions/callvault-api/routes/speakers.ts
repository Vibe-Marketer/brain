/**
 * routes/speakers.ts — GET /v1/speakers handler
 *
 * Returns deduplicated call participants visible to the authenticated token.
 * Scoped through the token's org workspaces (organization_id on call_participants).
 *
 * Response envelope: { data: Speaker[], pagination: PaginationMeta }
 *
 * Security (T-06.2-05): speakers are scoped through token workspace/org context.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ApiTokenContext } from '../auth.ts';
import { jsonOk, jsonError, type PaginationMeta } from '../responses.ts';

export interface SpeakerItem {
  name: string;
  email: string | null;
  participant_type: string;
}

export async function handleListSpeakers(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  tokenCtx: ApiTokenContext,
): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10))) : 50;
  const search = url.searchParams.get('search')?.trim() ?? '';

  // Resolve workspace IDs visible to this token (T-06.2-05)
  let wsIds: string[];

  if (tokenCtx.scope === 'workspace') {
    wsIds = [tokenCtx.workspace_id!];
  } else {
    const { data: orgWs, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('organization_id', tokenCtx.org_id);

    if (wsError) {
      console.error('callvault-api speakers: failed to resolve org workspaces', wsError);
      return jsonError(500, 'INTERNAL_ERROR', 'Failed to resolve organization workspaces');
    }

    wsIds = (orgWs ?? []).map((w: { id: string }) => w.id);
  }

  if (wsIds.length === 0) {
    return jsonOk<SpeakerItem>([], { count: 0, has_more: false, next_cursor: null, limit });
  }

  // Resolve organization IDs from workspace IDs (call_participants uses org-level scoping)
  const { data: wsOrgs } = await supabase
    .from('workspaces')
    .select('organization_id')
    .in('id', wsIds);

  const orgIds = [
    ...new Set((wsOrgs ?? []).map((w: { organization_id: string }) => w.organization_id)),
  ];

  if (orgIds.length === 0) {
    return jsonOk<SpeakerItem>([], { count: 0, has_more: false, next_cursor: null, limit });
  }

  let query = supabase
    .from('call_participants')
    .select('name, email, participant_type')
    .in('organization_id', orgIds)
    .not('name', 'is', null)
    .order('name', { ascending: true })
    .limit(limit * 3); // over-fetch to deduplicate in memory before applying limit

  if (search) {
    const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('callvault-api speakers error:', error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to list speakers');
  }

  type SpeakerRow = { name: string | null; email: string | null; participant_type: string };

  // Deduplicate by name+email combination
  const seen = new Set<string>();
  const unique: SpeakerItem[] = [];

  for (const s of (rows ?? []) as SpeakerRow[]) {
    if (!s.name) continue;
    const key = `${s.name.toLowerCase()}|${(s.email ?? '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({
        name: s.name,
        email: s.email ?? null,
        participant_type: s.participant_type,
      });
    }
    if (unique.length >= limit) break;
  }

  // Speakers endpoint uses simple count-based pagination without cursor
  // (deduplication makes keyset pagination impractical)
  const pagination: PaginationMeta = {
    count: unique.length,
    has_more: unique.length >= limit,
    next_cursor: null,
    limit,
  };

  return jsonOk<SpeakerItem>(unique, pagination);
}
