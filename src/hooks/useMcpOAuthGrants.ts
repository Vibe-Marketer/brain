import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getMcpOAuthGrants,
  persistMcpOAuthGrant,
  revokeMcpOAuthGrant,
  type PersistMcpOAuthGrantParams,
} from '@/services/mcp-oauth-grants.service'
import { useAuth } from '@/contexts/AuthContext'

const MCP_OAUTH_GRANT_KEYS = {
  all: ['mcp-oauth-grants'] as const,
  list: () => ['mcp-oauth-grants', 'list'] as const,
} as const

export function usePersistMcpOAuthGrant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: PersistMcpOAuthGrantParams) => persistMcpOAuthGrant(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MCP_OAUTH_GRANT_KEYS.all })
    },
    onError: (err: Error) => {
      toast.error(`Failed to save OAuth grant: ${err.message}`)
    },
  })
}

export function useMcpOAuthGrantsList() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: MCP_OAUTH_GRANT_KEYS.list(),
    queryFn: getMcpOAuthGrants,
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  return {
    grants: data ?? [],
    isLoading,
    error,
  }
}

export function useRevokeMcpOAuthGrant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeMcpOAuthGrant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MCP_OAUTH_GRANT_KEYS.all })
      toast.success('AI client revoked')
    },
    onError: (err: Error) => {
      toast.error(`Failed to revoke AI client: ${err.message}`)
    },
  })
}
