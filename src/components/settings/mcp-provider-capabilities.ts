export type McpProviderSetupAction = 'connect_oauth' | 'copy_setup' | 'open_setup_guide'

export type McpProviderId =
  | 'claude-desktop'
  | 'cursor'
  | 'generic-mcp'
  | 'chatgpt'
  | 'perplexity'
  | 'gemini'
  | 'manus'

export interface McpProviderCapability {
  id: McpProviderId
  label: string
  setupAction: McpProviderSetupAction
  setupGuideUrl: string
  notes: string
}

export const MCP_PROVIDER_CAPABILITIES: Record<McpProviderId, McpProviderCapability> = {
  'claude-desktop': {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    setupAction: 'connect_oauth',
    setupGuideUrl: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    notes: 'OAuth-first flow is supported from CallVault and may require refresh after permission updates.',
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    setupAction: 'copy_setup',
    setupGuideUrl: 'https://docs.cursor.com/context/model-context-protocol',
    notes: 'Use copied MCP URL/token snippets; no baseline Add to Cursor deep link is promised.',
  },
  'generic-mcp': {
    id: 'generic-mcp',
    label: 'Generic MCP Client',
    setupAction: 'copy_setup',
    setupGuideUrl: 'https://modelcontextprotocol.io/specification/2025-03-26',
    notes: 'Use manual MCP endpoint and token configuration.',
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    setupAction: 'open_setup_guide',
    setupGuideUrl: 'https://platform.openai.com/docs/mcp/',
    notes: 'Provider setup details can evolve; use guided/manual setup for the Phase 03 baseline.',
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    setupAction: 'open_setup_guide',
    setupGuideUrl: 'https://docs.perplexity.ai/docs/getting-started/integrations/mcp-server',
    notes: 'Use the CallVault OAuth credential generator above when Perplexity asks for client ID and secret.',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    setupAction: 'open_setup_guide',
    setupGuideUrl: 'https://ai.google.dev/gemini-api/docs/function-calling',
    notes: 'Ship guided/manual setup only for baseline; no one-click add flow is assumed.',
  },
  manus: {
    id: 'manus',
    label: 'Manus',
    setupAction: 'open_setup_guide',
    setupGuideUrl: 'https://manus.im/docs/integrations/mcp-connectors',
    notes: 'Use guided/manual setup until provider deep-link/install contracts are verified.',
  },
}

export const MCP_SETUP_PROVIDER_ORDER: McpProviderId[] = [
  'claude-desktop',
  'cursor',
  'generic-mcp',
  'chatgpt',
  'perplexity',
  'gemini',
  'manus',
]

export function getProviderSetupActionLabel(capability: McpProviderCapability): string {
  if (capability.setupAction === 'connect_oauth') return 'Connect with OAuth'
  if (capability.setupAction === 'copy_setup') return 'Copy setup'
  return 'Open setup guide'
}
