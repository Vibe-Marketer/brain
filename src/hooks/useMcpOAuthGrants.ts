import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  persistMcpOAuthGrant,
  type PersistMcpOAuthGrantParams,
} from '@/services/mcp-oauth-grants.service'

export function usePersistMcpOAuthGrant() {
  return useMutation({
    mutationFn: (params: PersistMcpOAuthGrantParams) => persistMcpOAuthGrant(params),
    onError: (err: Error) => {
      toast.error(`Failed to save OAuth grant: ${err.message}`)
    },
  })
}
