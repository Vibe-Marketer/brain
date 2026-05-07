/**
 * useMcpTokenCapabilities — TanStack Query mutation for per-token category toggles
 *
 * Phase 23 (D-10): optimistic update + rollback on error.
 * Mirrors the optimistic-update pattern from `useMcpTokens.ts` but tailored
 * to the toggle UX — the user sees the switch flip immediately, then the
 * server write completes in the background. On error, we restore the prior
 * state and surface a Sonner toast.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setEnabledCategories, type EnabledCategoriesValue } from '@/services/mcp-token-capabilities.service'
import type { McpToken } from '@/services/mcp-tokens.service'

const MCP_TOKEN_KEYS = {
  all: ['mcp-tokens'] as const,
  list: () => ['mcp-tokens', 'list'] as const,
} as const

interface MutationVars {
  tokenId: string
  value: EnabledCategoriesValue
}

interface MutationContext {
  previousTokens: McpToken[] | undefined
}

/**
 * useSetMcpTokenCategories
 *
 * Mutates `mcp_tokens.enabled_categories` for a single token. Optimistic:
 * on call, the local query cache is patched immediately so the Switch UI
 * reflects the new state in the same render. On server error, the cache is
 * rolled back and a toast surfaces.
 */
export function useSetMcpTokenCategories() {
  const queryClient = useQueryClient()

  return useMutation<McpToken, Error, MutationVars, MutationContext>({
    mutationFn: ({ tokenId, value }) => setEnabledCategories(tokenId, value),

    // Optimistic update — patch the cache before the server write returns.
    onMutate: async ({ tokenId, value }) => {
      await queryClient.cancelQueries({ queryKey: MCP_TOKEN_KEYS.list() })
      const previousTokens = queryClient.getQueryData<McpToken[]>(MCP_TOKEN_KEYS.list())

      if (previousTokens) {
        queryClient.setQueryData<McpToken[]>(
          MCP_TOKEN_KEYS.list(),
          previousTokens.map((t) =>
            t.id === tokenId ? { ...t, enabled_categories: value } : t,
          ),
        )
      }

      return { previousTokens }
    },

    onError: (err, _vars, context) => {
      if (context?.previousTokens) {
        queryClient.setQueryData(MCP_TOKEN_KEYS.list(), context.previousTokens)
      }
      toast.error(`Failed to save permissions: ${err.message}`)
    },

    // Re-fetch after settle to ensure cache matches server (covers any
    // race between optimistic patch and a concurrent fetch).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all })
    },
  })
}
