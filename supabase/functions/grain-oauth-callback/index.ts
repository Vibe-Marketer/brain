import { createOAuthCallbackHandler } from '../_shared/oauth-callback-handler.ts';
import { GrainClient } from '../_shared/grain-client.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

const handler = createOAuthCallbackHandler({
  sourceApp: 'grain',
  providerLabel: 'Grain',
  clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
  clientSecretEnv: 'GRAIN_OAUTH_CLIENT_SECRET',
  redirectUriEnv: 'GRAIN_OAUTH_REDIRECT_URI',
  redirectPathSegment: 'grain',
  resolveSource: (supabase, userId, sourceId) => resolveGrainSource(supabase, userId, sourceId),
  exchangeToken: ({ code, clientId, clientSecret, redirectUri, codeVerifier }) =>
    GrainClient.exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri, codeVerifier }),
  testToken: async (accessToken) => {
    await new GrainClient({ accessToken }).testToken();
  },
  successMessage: 'Successfully connected to Grain. Select recordings to import when you are ready.',
  responseExtras: { webhookRegistration: 'triggered' },
  onSuccess: ({ supabase, sourceId, req }) => {
    // Register Grain webhooks asynchronously so the OAuth response isn't blocked.
    // Forward the caller's Authorization header so the invoked function inherits auth.
    const authHeaderForward = req.headers.get('Authorization') || '';
    const webhookTask = supabase.functions
      .invoke('grain-create-webhooks', {
        body: { sourceId },
        headers: { Authorization: authHeaderForward, 'Content-Type': 'application/json' },
      })
      .then((result: { error?: unknown }) => {
        if (result.error) console.error('[grain-oauth-callback] webhook registration invoke error:', result.error);
      })
      .catch((error: unknown) => console.error('[grain-oauth-callback] webhook registration invoke threw:', error));

    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(webhookTask);
  },
});

Deno.serve(handler);
