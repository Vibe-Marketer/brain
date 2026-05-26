import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from './auth.ts';
import { getCorsHeaders } from './cors.ts';
import { createPkcePair } from './oauth-pkce.ts';

type SupabaseClient = any;

export type OAuthSourceApp = 'grain' | 'read-ai';

/**
 * Source resolver contract — each provider injects its own implementation that
 * scopes the lookup to the right `source_app`. Returns the source row if the
 * caller-provided sourceId belongs to them, or null when not found.
 */
export type ResolveOAuthSource = (
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
) => Promise<{ id: string } | null>;

export interface BuildAuthorizationUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: string[];
}

export interface CreateOAuthUrlHandlerConfig {
  /** Stable identifier for the source_app column. */
  sourceApp: OAuthSourceApp;
  /** Human-readable name for error messages ("Grain", "Read.ai"). */
  providerLabel: string;
  /** Env var holding the OAuth client id (e.g. "GRAIN_OAUTH_CLIENT_ID"). */
  clientIdEnv: string;
  /** Env var override for the redirect URI (e.g. "GRAIN_OAUTH_REDIRECT_URI"). */
  redirectUriEnv: string;
  /** Path segment under /oauth/callback/ (e.g. "grain", "read-ai"). */
  redirectPathSegment: string;
  /** Provider-specific authorization URL builder. */
  buildAuthorizationUrl: (params: BuildAuthorizationUrlParams) => string;
  /** Default scope list passed through to buildAuthorizationUrl. */
  defaultScopes: string[];
  /** Lookup helper scoped to this provider's source_app. */
  resolveSource: ResolveOAuthSource;
}

interface OAuthUrlRequest {
  sourceId?: string | null;
}

/**
 * Build a `(req: Request) => Promise<Response>` handler that:
 *   1. handles CORS preflight + auth via the shared helpers,
 *   2. resolves or provisions the import_sources row,
 *   3. generates a one-shot state + PKCE pair,
 *   4. persists them to user_settings as `${sourceApp}:${state}:${verifier}`,
 *   5. returns `{ success, authUrl, sourceId, state }`.
 *
 * Provider-specific concerns (auth URL shape, scopes) are injected via config.
 */
export function createOAuthUrlHandler(
  config: CreateOAuthUrlHandlerConfig,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
      if (authResult instanceof Response) return authResult;
      const userId = authResult.userId;

      const body = (await req.json().catch(() => ({}))) as OAuthUrlRequest;
      const clientId = Deno.env.get(config.clientIdEnv);
      const redirectUri = resolveRedirectUri(origin, config.redirectUriEnv, config.redirectPathSegment);

      if (!clientId) {
        return json(
          { success: false, error: `${config.providerLabel} OAuth is not configured. Set ${config.clientIdEnv}.` },
          500,
          corsHeaders,
        );
      }

      const requestedSourceId = body.sourceId ?? null;
      let sourceId = requestedSourceId;
      if (requestedSourceId) {
        const source = await config.resolveSource(supabase, userId, requestedSourceId);
        if (!source) {
          return json(
            { success: false, error: `${config.providerLabel} source not found.` },
            404,
            corsHeaders,
          );
        }
      } else {
        const { data, error } = await supabase
          .from('import_sources')
          .insert({
            user_id: userId,
            source_app: config.sourceApp,
            is_active: false,
            connection_metadata: { auth_type: 'oauth' },
          })
          .select('id')
          .single();
        if (error || !data?.id) {
          throw new Error(error?.message ?? `Failed to initialize ${config.providerLabel} source`);
        }
        sourceId = data.id;
      }

      const state = crypto.randomUUID();
      const pkce = await createPkcePair();
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            oauth_state: `${config.sourceApp}:${state}:${pkce.verifier}`,
            pending_import_source_id: sourceId,
          },
          { onConflict: 'user_id' },
        );
      if (settingsError) {
        console.error(`Failed to persist ${config.providerLabel} OAuth state:`, {
          userId,
          sourceId,
          error: settingsError,
        });
        return json(
          { success: false, error: `Failed to start ${config.providerLabel} OAuth. Try again.` },
          500,
          corsHeaders,
        );
      }

      const authUrl = config.buildAuthorizationUrl({
        clientId,
        redirectUri,
        state,
        codeChallenge: pkce.challenge,
        scopes: config.defaultScopes,
      });
      return json({ success: true, authUrl, sourceId, state }, 200, corsHeaders);
    } catch (error) {
      console.error(`Error generating ${config.providerLabel} OAuth URL:`, error);
      return json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        500,
        corsHeaders,
      );
    }
  };
}

/**
 * Resolve the callback URL the browser will redirect to after consent.
 *
 * Same allow-list as the pre-refactor handlers:
 *   - http://127.0.0.1:8080 / http://localhost:8080 (local dev)
 *   - https://app.callvaultai.com (prod)
 * Anything else falls back to the env override or the SITE_URL default.
 *
 * Exported (and named with the `resolveGrain*` / `resolveReadAi*` aliases via
 * the thin handlers) so the existing source-string tests keep matching.
 */
export function resolveRedirectUri(
  origin: string | null,
  redirectUriEnv: string,
  pathSegment: string,
): string {
  if (
    origin === 'http://127.0.0.1:8080' ||
    origin === 'http://localhost:8080' ||
    origin === 'https://app.callvaultai.com'
  ) {
    return `${origin}/oauth/callback/${pathSegment}`;
  }

  return (
    Deno.env.get(redirectUriEnv) ||
    `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/${pathSegment}`
  );
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
