import { unauthorizedResponse } from "./tools/utils.ts";

export interface RoutingContext {
  workspaceId: string | null;
  originHost: string;
}

export function extractRoutingContext(req: Request): RoutingContext {
  const url = new URL(req.url);
  const originHost = req.headers.get('x-forwarded-host') || url.host;

  // Extract /mcp/w/{workspace_uuid} from pathname
  const workspaceMatch = url.pathname.match(/^\/mcp\/w\/([0-9a-fA-F-]{36})\/?/);
  const workspaceId = workspaceMatch ? workspaceMatch[1] : null;

  return { workspaceId, originHost };
}

export function handleDiscovery(req: Request, routingContext: RoutingContext, corsHeaders: Record<string, string>) {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
    const resource = routingContext.workspaceId 
      ? `https://${routingContext.originHost}/mcp/w/${routingContext.workspaceId}`
      : `https://${routingContext.originHost}/mcp`;

    return new Response(JSON.stringify({ resource }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return null;
}
