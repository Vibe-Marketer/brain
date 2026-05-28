import { useMutation } from '@tanstack/react-query'
import {
  registerMcpOAuthClient,
  type RegisteredMcpOAuthClient,
  type RegisterMcpOAuthClientParams,
} from '@/services/mcp-oauth-clients.service'

export function useRegisterMcpOAuthClient() {
  return useMutation<RegisteredMcpOAuthClient, Error, RegisterMcpOAuthClientParams>({
    mutationFn: registerMcpOAuthClient,
  })
}
