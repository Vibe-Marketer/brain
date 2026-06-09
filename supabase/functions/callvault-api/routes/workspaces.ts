/**
 * routes/workspaces.ts — GET /v1/workspaces handler
 *
 * Returns all workspaces visible to the authenticated API token:
 * - workspace-scoped token: returns only the token's workspace
 * - organization-scoped token: returns all workspaces in the organization
 *
 * Response envelope: { data: Workspace[], pagination: PaginationMeta }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ApiTokenContext } from '../auth.ts';
import { jsonOk, jsonError, type PaginationMeta } from '../responses.ts';

export interface WorkspaceItem {
  id: string;
  name: string;
  created_at: string | null;
}

export async function handleListWorkspaces(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  tokenCtx: ApiTokenContext,
): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50;
  const cursor = url.searchParams.get('cursor') ?? undefined;

  let query = supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('name', { ascending: true })
    .limit(limit + 1); // fetch one extra to determine has_more

  if (tokenCtx.scope === 'workspace' && tokenCtx.workspace_id) {
    // Workspace-scoped: only return the token's workspace
    query = query.eq('id', tokenCtx.workspace_id);
  } else {
    // Organization-scoped: return all workspaces in org (T-06.2-05)
    query = query.eq('organization_id', tokenCtx.org_id);
  }

  // Cursor-based pagination: cursor is the workspace name (alphabetical)
  if (cursor) {
    query = query.gt('name', cursor);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('callvault-api workspaces error:', error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to list workspaces');
  }

  const all = (rows ?? []) as WorkspaceItem[];
  const has_more = all.length > limit;
  const page = has_more ? all.slice(0, limit) : all;
  const next_cursor = has_more && page.length > 0 ? (page[page.length - 1]?.name ?? null) : null;

  const pagination: PaginationMeta = {
    count: page.length,
    has_more,
    next_cursor,
    limit,
  };

  return jsonOk<WorkspaceItem>(page, pagination);
}
