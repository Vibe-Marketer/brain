import { createOAuthUrlHandler } from '../_shared/oauth-url-handler.ts';
import { GrainClient } from '../_shared/grain-client.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

const handler = createOAuthUrlHandler({
  sourceApp: 'grain',
  providerLabel: 'Grain',
  clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
  redirectUriEnv: 'GRAIN_OAUTH_REDIRECT_URI',
  redirectPathSegment: 'grain',
  defaultScopes: [],
  resolveSource: (supabase, userId, sourceId) => resolveGrainSource(supabase, userId, sourceId),
  buildAuthorizationUrl: ({ clientId, redirectUri, state, codeChallenge }) =>
    GrainClient.buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge }),
});

Deno.serve(handler);
