import { getMcpUrl } from '@/services/mcp-tokens.service'

export interface RegisterMcpOAuthClientParams {
  clientName: string
  redirectUris: string[]
}

export interface RegisteredMcpOAuthClient {
  client_id: string
  client_secret?: string
  client_secret_expires_at?: number
  client_id_issued_at?: number
  redirect_uris: string[]
  token_endpoint_auth_method: 'client_secret_post' | 'client_secret_basic' | 'none'
}

interface OAuthRegistrationErrorBody {
  msg?: unknown
  error?: unknown
  error_description?: unknown
}

function getRegistrationEndpoint(): string {
  const mcpUrl = new URL(getMcpUrl())
  return `${mcpUrl.origin}/mcp-register`
}

function readErrorMessage(body: OAuthRegistrationErrorBody): string {
  if (typeof body.msg === 'string' && body.msg.length > 0) return body.msg
  if (typeof body.error_description === 'string' && body.error_description.length > 0) return body.error_description
  if (typeof body.error === 'string' && body.error.length > 0) return body.error
  return 'Failed to register OAuth client'
}

export async function registerMcpOAuthClient(
  params: RegisterMcpOAuthClientParams,
): Promise<RegisteredMcpOAuthClient> {
  const response = await fetch(getRegistrationEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: params.clientName,
      redirect_uris: params.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: 'openid email profile',
    }),
  })

  const body = await response.json() as RegisteredMcpOAuthClient | OAuthRegistrationErrorBody
  if (!response.ok) {
    throw new Error(readErrorMessage(body as OAuthRegistrationErrorBody))
  }

  if (typeof (body as RegisteredMcpOAuthClient).client_id !== 'string') {
    throw new Error('OAuth registration response did not include a client ID')
  }

  return body as RegisteredMcpOAuthClient
}
