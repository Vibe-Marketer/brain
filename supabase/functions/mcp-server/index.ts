import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicCorsHeaders } from '../_shared/cors.ts';
import { TOOL_CATEGORIES } from '../_shared/mcp-tool-categories.ts';
import { tools } from "./tools/registry.ts";
import { mcpJsonResult, mcpError, unauthorizedResponse, isPaidTier } from "./tools/utils.ts";
import { type JsonRpcRequest, type McpToken } from './tools/types.ts';
import { extractRoutingContext, handleDiscovery } from './routing.ts';
import { authenticateMcpRequest } from './auth.ts';

Deno.serve(async (req) => {
  const corsHeaders = getPublicCorsHeaders();
  const routingContext = extractRoutingContext(req);
  const originHost = routingContext.originHost;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle OAuth resource discovery
  const discoveryResponse = handleDiscovery(req, routingContext, corsHeaders);
  if (discoveryResponse) {
    return discoveryResponse;
  }

  if (req.method !== 'POST') {
    return unauthorizedResponse(null, corsHeaders, originHost, 'Authorization required (MCP requires POST with bearer token)');
  }

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { id = null, method, params = {} } = body;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey;
  
  const supabase = createClient(supabaseUrl, serviceKey);
  const authClient = createClient(supabaseUrl, anonKey);

  const authResult = await authenticateMcpRequest(req, routingContext, authClient, corsHeaders, id);
  if (authResult instanceof Response) {
    return authResult;
  }
  
  const mcpToken = authResult.mcpToken;

  if (method === 'initialize') {
    return mcpJsonResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: {
        name: 'callvault',
        title: 'CallVault',
        version: '2.0.0',
      },
      instructions: 'CallVault MCP server — search calls, manage contacts, folders, tags, and more across your organization.',
    });
  }

  if (method === 'tools/list') {
    const listModule = await import('./tools/read/list.ts');
    return listModule.handler({ params, mcpToken, id, supabase, corsHeaders });
  }

  const { data: ownerProfile } = await supabase
    .from('user_profiles')
    .select('subscription_status, product_id, current_period_end')
    .eq('user_id', mcpToken.user_id)
    .maybeSingle();

  const paid = isPaidTier(
    ownerProfile?.product_id ?? null,
    ownerProfile?.subscription_status ?? null,
    ownerProfile?.current_period_end ?? null,
  );
  if (!paid) {
    console.warn(`mcp-server: user ${mcpToken.user_id} has no active paid plan`);
    return mcpError(id, -32001, 'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings', corsHeaders);
  }

  let toolName = method;
  if (method === 'tools/call') {
    toolName = typeof params.name === 'string' ? params.name : '';
    if (params.arguments && typeof params.arguments === 'object') {
      Object.assign(params, params.arguments as Record<string, unknown>);
    }
  }

  if (
    mcpToken.enabled_categories !== null &&
    method === 'tools/call'
  ) {
    const category = TOOL_CATEGORIES[toolName];
    if (!category) {
      return mcpError(
        id,
        -32001,
        `Tool '${toolName}' is not recognized. The MCP token's category whitelist does not cover unknown tools — contact CallVault support if this is a server-side bug.`,
        corsHeaders,
      );
    }
    if (!mcpToken.enabled_categories.includes(category)) {
      return mcpError(
        id,
        -32001,
        `Tool '${toolName}' is disabled for this token. Enable the '${category}' category in Settings > Integrations.`,
        corsHeaders,
      );
    }
  }

  try {
    if (toolName in tools) {
      const module = await tools[toolName as keyof typeof tools]();
      return module.handler({ params, mcpToken, id, supabase, corsHeaders });
    } else {
      return mcpError(id, -32601, `Method '${method}' not found`, corsHeaders);
    }
  } catch (err) {
    console.error('mcp-server unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return mcpError(id, -32603, message, corsHeaders);
  }
});

