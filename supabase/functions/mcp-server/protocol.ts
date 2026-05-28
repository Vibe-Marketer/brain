import type { McpResult } from './tools/_types.ts';

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

/** Return structured JSON directly as result (for initialize, tools/list - NOT tool calls) */
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

/**
 * RFC 9728 / MCP 2025-06-18 authorization compliant 401 response.
 * Always carries WWW-Authenticate so spec-strict clients can discover the
 * OAuth flow and retry with a valid bearer token.
 */
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

export function forbiddenResponse(
  id: string | number | null,
  corsHeaders: Record<string, string>,
  message = 'Forbidden',
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32001, message } }),
    {
      status: 403,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  );
}

const ALLOWED_HOSTS = new Set(['api.callvaultai.com', 'mcp.callvaultai.com']);
const FALLBACK_HOST = 'api.callvaultai.com';

export function resolveOriginHost(req: Request): string {
  const headerValue =
    req.headers.get('x-callvault-host') ?? req.headers.get('x-forwarded-host');
  const fwd = headerValue?.split(',')[0]?.trim();
  if (fwd && ALLOWED_HOSTS.has(fwd)) return fwd;
  return FALLBACK_HOST;
}

export function buildResourceMetadataUrl(host: string): string {
  return `https://${host}/.well-known/oauth-protected-resource/mcp`;
}
