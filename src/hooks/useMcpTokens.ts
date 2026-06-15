/**
 * useMcpTokens — TanStack Query hooks for MCP token management
 *
 * Wraps the mcp-tokens service with React Query for caching + mutation handling.
 *
 * @pattern tanstack-query-hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getMcpManualTokenConnections,
  createMcpToken,
  deleteMcpToken,
  regenerateMcpToken,
  type McpToken,
  type CreateMcpTokenParams,
} from '@/services/mcp-tokens.service'
import { useAuth } from '@/contexts/AuthContext'

// ─── Query keys ───────────────────────────────────────────────────────────────

const MCP_TOKEN_KEYS = {
  all: ['mcp-tokens'] as const,
  list: () => ['mcp-tokens', 'list'] as const,
} as const

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useMcpTokensList — Returns all MCP tokens for the current user.
 */
export function useMcpTokensList() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: MCP_TOKEN_KEYS.list(),
    queryFn: getMcpManualTokenConnections,
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute — tokens change rarely
  })
  const tokens: McpToken[] = data ?? []

  return {
    tokens,
    tokenConnections: data ?? [],
    isLoading,
    error,
  }
}

/**
 * useCreateMcpToken — Mutation to create a new MCP token.
 *
 * On success: invalidates the tokens list and calls onSuccess with the new token
 * so the UI can display the token value exactly once.
 */
export function useCreateMcpToken(options?: {
  onSuccess?: (token: McpToken) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateMcpTokenParams) => createMcpToken(params),
    onSuccess: (newToken) => {
      queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all })
      options?.onSuccess?.(newToken)
      toast.success('MCP token created')
    },
    onError: (err: Error) => {
      toast.error(`Failed to create token: ${err.message}`)
    },
  })
}

/**
 * useDeleteMcpToken — Mutation to delete an MCP token by ID.
 */
export function useDeleteMcpToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteMcpToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all })
      toast.success('MCP token deleted')
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete token: ${err.message}`)
    },
  })
}

/**
 * useRegenerateMcpToken — Mutation to regenerate an MCP token.
 *
 * On success: invalidates the tokens list and calls onSuccess with the
 * regenerated token so the UI can display the new token value via TokenRevealDialog.
 */
export function useRegenerateMcpToken(options?: {
  onSuccess?: (token: McpToken) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => regenerateMcpToken(id),
    onSuccess: (regeneratedToken) => {
      queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all })
      options?.onSuccess?.(regeneratedToken)
      toast.success('MCP token regenerated')
    },
    onError: (err: Error) => {
      toast.error(`Failed to regenerate token: ${err.message}`)
    },
  })
}
