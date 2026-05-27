import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type McpResult } from './types.ts';

export function mcpOk(id: string | number | null, data: unknown): Response {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return Response.json({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text }],
    } satisfies McpResult,
  });
}

/** Return structured JSON directly as result (for initialize, tools/list — NOT tool calls) */
export function mcpJsonResult(id: string | number | null, result: unknown): Response {
  return Response.json({ jsonrpc: '2.0', id, result });
}

export function mcpError(
  id: string | number | null,
  code: number,
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

export async function fetchOrgWorkspaceIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ ids: string[] | null; error: boolean }> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', orgId);

  if (error) {
    console.error('mcp-server org-workspace lookup failed:', error);
    return { ids: null, error: true };
  }

  return { ids: (data ?? []).map((w: { id: string }) => w.id), error: false };
}

const POLAR_PRODUCT_TIERS: Record<string, 'pro' | 'team'> = {
  '30020903-fa8f-4534-9cf1-6e9fba26584c': 'pro',
  '9ff62255-446c-41fe-a84d-c04aed23725c': 'pro',
  '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7': 'team',
  '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f': 'team',
};

const ALLOWED_HOSTS = new Set(['api.callvaultai.com', 'mcp.callvaultai.com']);
const FALLBACK_HOST = 'api.callvaultai.com';

function buildResourceMetadataUrl(host: string): string {
  return `https://${host}/.well-known/oauth-protected-resource/mcp`;
}

export function unauthorizedResponse(
  id: string | number | null,
  corsHeaders: Record<string, string>,
  host: string,
  message = 'Authorization required',
): Response {
  const resourceMetadataUrl = buildResourceMetadataUrl(host);
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32001, message } }),
    {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="callvault", resource_metadata="${resourceMetadataUrl}"`,
      },
    },
  );
}

export function isPaidTier(
  productId: string | null,
  status: string | null,
  periodEnd: string | null,
): boolean {
  if (!productId || !status) return false;

  // Pro trial: only active if trialing and not expired
  if (productId === 'pro-trial') {
    if (status !== 'trialing') return false;
    if (periodEnd && new Date(periodEnd) < new Date()) return false;
    return true;
  }

  return Boolean(POLAR_PRODUCT_TIERS[productId])
    && (status === 'active' || status === 'trialing');
}

export function resolveOriginHost(req: Request): string {
  // Prefer X-Callvault-Host (custom header — Supabase's CDN strips the
  // standard X-Forwarded-Host before it reaches the function). Fall back to
  // X-Forwarded-Host just in case the function is ever invoked from a runtime
  // that doesn't strip it.
  const headerValue =
    req.headers.get('x-callvault-host') ?? req.headers.get('x-forwarded-host');
  const fwd = headerValue?.split(',')[0]?.trim();
  if (fwd && ALLOWED_HOSTS.has(fwd)) return fwd;
  return FALLBACK_HOST;
}
