/**
 * useApiTokens — TanStack Query hooks for CallVault REST API tokens.
 *
 * @pattern tanstack-query-hooks
 *
 * Query key: ['api-tokens'] — stable key for invalidation across all token mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getApiTokens,
  generateApiToken,
  revokeApiToken,
  type ApiToken,
  type GeneratedApiToken,
  type GenerateApiTokenParams,
} from '@/services/api-tokens.service'
import { useAuth } from '@/contexts/AuthContext'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const API_TOKEN_KEYS = {
  all: ['api-tokens'] as const,
  list: () => ['api-tokens', 'list'] as const,
} as const

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useApiTokensList — Returns all active API tokens for the current user.
 */
export function useApiTokensList() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: API_TOKEN_KEYS.list(),
    queryFn: getApiTokens,
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  return {
    tokens: data ?? ([] as ApiToken[]),
    isLoading,
    error,
  }
}

/**
 * useGenerateApiToken — Mutation to generate a new CallVault API token.
 *
 * On success: invalidates the ['api-tokens'] query key and calls onSuccess with
 * the new token so the UI can show the raw value exactly once.
 */
export function useGenerateApiToken(options?: {
  onSuccess?: (token: GeneratedApiToken) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: GenerateApiTokenParams) => generateApiToken(params),
    onSuccess: (newToken) => {
      queryClient.invalidateQueries({ queryKey: API_TOKEN_KEYS.all })
      options?.onSuccess?.(newToken)
    },
    onError: (err: Error) => {
      toast.error(`Failed to generate API token: ${err.message}`)
    },
  })
}

/**
 * useRevokeApiToken — Mutation to revoke a CallVault API token by ID.
 */
export function useRevokeApiToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeApiToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_TOKEN_KEYS.all })
      toast.success('API token revoked')
    },
    onError: (err: Error) => {
      toast.error(`Failed to revoke token: ${err.message}`)
    },
  })
}
