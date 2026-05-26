import { createOAuthCallbackHandler } from '../_shared/oauth-callback-handler.ts';
import { ReadAiClient } from '../_shared/read-ai-client.ts';
import { resolveReadAiSource } from '../_shared/read-ai-source.ts';

const handler = createOAuthCallbackHandler({
  sourceApp: 'read-ai',
  providerLabel: 'Read.ai',
  clientIdEnv: 'READAI_OAUTH_CLIENT_ID',
  clientSecretEnv: 'READAI_OAUTH_CLIENT_SECRET',
  redirectUriEnv: 'READAI_OAUTH_REDIRECT_URI',
  redirectPathSegment: 'read-ai',
  resolveSource: (supabase, userId, sourceId) => resolveReadAiSource(supabase, userId, sourceId),
  exchangeToken: ({ code, clientId, clientSecret, redirectUri, codeVerifier }) =>
    ReadAiClient.exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri, codeVerifier }),
  testToken: async (accessToken) => {
    await new ReadAiClient({ accessToken }).testToken();
  },
  extractAccountEmail: (tokens) => extractEmailFromJwt(tokens.id_token),
  buildConnectionMetadata: (tokens) => ({ auth_type: 'oauth', scope: tokens.scope ?? null }),
  successMessage: 'Successfully connected to Read.ai. Select meetings to import when you are ready.',
});

Deno.serve(handler);

function extractEmailFromJwt(jwt: string | null | undefined): string | null {
  if (!jwt) return null;
  try {
    const payload = JSON.parse(
      atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, unknown>;
    return typeof payload.email === 'string' && payload.email.includes('@') ? payload.email : null;
  } catch {
    return null;
  }
}
