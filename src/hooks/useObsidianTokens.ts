/**
 * useObsidianTokens — TanStack Query hooks for Obsidian personal API tokens.
 *
 * @pattern tanstack-query-hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getObsidianTokens,
  generateObsidianToken,
  revokeObsidianToken,
  type ObsidianToken,
  type GeneratedObsidianToken,
} from '@/services/obsidian-tokens.service'
import { useAuth } from '@/contexts/AuthContext'

// ─── Query keys ───────────────────────────────────────────────────────────────

const OBSIDIAN_TOKEN_KEYS = {
  all: ['obsidian-tokens'] as const,
  list: () => ['obsidian-tokens', 'list'] as const,
} as const

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useObsidianTokensList — Returns all active Obsidian tokens for the current user.
 */
export function useObsidianTokensList() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: OBSIDIAN_TOKEN_KEYS.list(),
    queryFn: getObsidianTokens,
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  return {
    tokens: data ?? ([] as ObsidianToken[]),
    isLoading,
    error,
  }
}

/**
 * useGenerateObsidianToken — Mutation to generate a new Obsidian token.
 *
 * On success: invalidates the token list and calls onSuccess with the new
 * token so the UI can show the raw value exactly once.
 */
export function useGenerateObsidianToken(options?: {
  onSuccess?: (token: GeneratedObsidianToken) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { org_id: string; name: string }) =>
      generateObsidianToken(params),
    onSuccess: (newToken) => {
      queryClient.invalidateQueries({ queryKey: OBSIDIAN_TOKEN_KEYS.all })
      options?.onSuccess?.(newToken)
    },
    onError: (err: Error) => {
      toast.error(`Failed to generate token: ${err.message}`)
    },
  })
}

/**
 * useRevokeObsidianToken — Mutation to revoke an Obsidian token by ID.
 */
export function useRevokeObsidianToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeObsidianToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OBSIDIAN_TOKEN_KEYS.all })
      toast.success('Obsidian token revoked')
    },
    onError: (err: Error) => {
      toast.error(`Failed to revoke token: ${err.message}`)
    },
  })
}
