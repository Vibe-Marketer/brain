import { type ToolCategory } from '../../_shared/mcp-tool-categories.ts';
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface JsonRpcRequest {
  jsonrpc?: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpToken {
  id: string;
  user_id: string;
  org_id: string | null;
  workspace_id: string | null;
  scope: 'workspace' | 'organization';
  name: string;
  enabled_categories: ToolCategory[] | null;
}

export interface McpContent {
  type: 'text';
  text: string;
}

export interface McpResult {
  content: McpContent[];
}

export interface McpRequestArgs {
  params: Record<string, unknown>;
  mcpToken: McpToken;
  id: string | number | null;
  supabase: SupabaseClient;
  corsHeaders: Record<string, string>;
}

export interface ToolModule {
  schema: {
    name: string;
    description: string;
    inputSchema?: any;
    outputSchema?: any;
  };
  handler: (args: McpRequestArgs) => Promise<Response>;
}
