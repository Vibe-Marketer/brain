import { type McpRequestArgs } from '../types.ts';
import { mcpJsonResult } from '../utils.ts';
import { schemas } from '../schemas.ts';
import { TOOL_CATEGORIES } from '../../../_shared/mcp-tool-categories.ts';

export const handler = async ({ id, mcpToken }: McpRequestArgs): Promise<Response> => {
  let filteredTools = schemas;

  if (mcpToken.enabled_categories !== null) {
    filteredTools = schemas.filter(tool => {
      const category = TOOL_CATEGORIES[tool.name as keyof typeof TOOL_CATEGORIES];
      if (!category) return false;
      return mcpToken.enabled_categories!.includes(category);
    });
  }

  return mcpJsonResult(id, { tools: filteredTools });
};
