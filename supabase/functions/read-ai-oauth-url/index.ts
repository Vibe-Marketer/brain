import { createOAuthUrlHandler } from '../_shared/oauth-url-handler.ts';
import { ReadAiClient } from '../_shared/read-ai-client.ts';
import { resolveReadAiSource } from '../_shared/read-ai-source.ts';

const handler = createOAuthUrlHandler({
  sourceApp: 'read-ai',
  providerLabel: 'Read.ai',
  clientIdEnv: 'READAI_OAUTH_CLIENT_ID',
  redirectUriEnv: 'READAI_OAUTH_REDIRECT_URI',
  redirectPathSegment: 'read-ai',
  defaultScopes: ['openid', 'email', 'offline_access', 'profile', 'meeting:read'],
  resolveSource: (supabase, userId, sourceId) => resolveReadAiSource(supabase, userId, sourceId),
  buildAuthorizationUrl: ({ clientId, redirectUri, state, codeChallenge, scopes }) =>
    ReadAiClient.buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scope: scopes.join(' '),
    }),
});

Deno.serve(handler);
