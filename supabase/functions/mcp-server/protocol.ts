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

export function mcpAccepted(corsHeaders: Record<string, string>): Response {
  return new Response(null, { status: 202, headers: corsHeaders });
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
  publicMcpPath: string,
  message = 'Authorization required',
): Response {
  const resourceMetadataUrl = buildResourceMetadataUrl(host, publicMcpPath);
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

export function resolvePublicMcpPath(req: Request): string {
  const headerPath = req.headers.get('x-callvault-public-path')?.trim();
  const normalizedHeaderPath = normalizePublicMcpPath(headerPath);
  if (normalizedHeaderPath) return normalizedHeaderPath;

  const pathname = new URL(req.url).pathname;
  const upstreamWorkspaceMatch = pathname.match(/\/mcp-server\/w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  if (upstreamWorkspaceMatch) return `/mcp/w/${upstreamWorkspaceMatch[1].toLowerCase()}`;

  return '/mcp';
}

function normalizePublicMcpPath(path: string | undefined): string | null {
  if (!path) return null;
  if (path === '/' || path === '/mcp') return path;

  const rootWorkspaceMatch = path.match(/^\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (rootWorkspaceMatch) return `/w/${rootWorkspaceMatch[1].toLowerCase()}`;

  const legacyWorkspaceMatch = path.match(/^\/mcp\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (legacyWorkspaceMatch) return `/mcp/w/${legacyWorkspaceMatch[1].toLowerCase()}`;

  return null;
}

export function buildResourceMetadataUrl(host: string, publicMcpPath: string): string {
  const normalizedPath = normalizePublicMcpPath(publicMcpPath) ?? '/mcp';
  if (normalizedPath === '/') {
    return `https://${host}/.well-known/oauth-protected-resource`;
  }
  return `https://${host}/.well-known/oauth-protected-resource${normalizedPath}`;
}

export function parseWorkspaceIdFromMcpPath(req: Request): string | null {
  const publicPath = resolvePublicMcpPath(req);
  const publicPathMatch = publicPath.match(/^\/(?:mcp\/)?w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  if (publicPathMatch) return publicPathMatch[1].toLowerCase();

  const pathname = new URL(req.url).pathname;
  const upstreamMatch = pathname.match(/\/mcp-server\/w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  return upstreamMatch ? upstreamMatch[1].toLowerCase() : null;
}
