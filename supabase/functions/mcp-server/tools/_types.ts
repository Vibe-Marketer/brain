import type { SupabaseClient as SupabaseClientType } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ToolCategory } from '../../_shared/mcp-tool-categories.ts';

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

export type SupabaseClient = SupabaseClientType;

export type ToolHandlerContext = {
  id: string | number | null;
  params: Record<string, unknown>;
  supabase: SupabaseClient;
  mcpToken: McpToken;
  corsHeaders: Record<string, string>;
  fetchOrgWorkspaceIds: (
    supabase: SupabaseClient,
    orgId: string,
  ) => Promise<{ ids: string[] | null; error: boolean }>;
};

export type ToolModule = {
  definition: unknown;
  category: ToolCategory;
  handler: (context: ToolHandlerContext) => Promise<Response> | Response;
};
