import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from './auth.ts';
import { getCorsHeaders } from './cors.ts';
import { persistOAuthTokens } from './connector-function-utils.ts';
import {
  type OAuthSourceApp,
  type ResolveOAuthSource,
  resolveRedirectUri,
} from './oauth-url-handler.ts';

type SupabaseClient = any;

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  id_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
}

export interface ExchangeTokenParams {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface OAuthCallbackSuccessContext {
  supabase: SupabaseClient;
  userId: string;
  sourceId: string;
  tokens: OAuthTokens;
  /** Original request — exposed so onSuccess can forward the Authorization header to invoked functions. */
  req: Request;
}

export interface CreateOAuthCallbackHandlerConfig {
  sourceApp: OAuthSourceApp;
  providerLabel: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Env var override for the redirect URI (must match what oauth-url-handler used). */
  redirectUriEnv: string;
  redirectPathSegment: string;
  /** Lookup helper scoped to this provider's source_app. */
  resolveSource: ResolveOAuthSource;
  /** Provider-specific token exchange. */
  exchangeToken: (params: ExchangeTokenParams) => Promise<OAuthTokens>;
  /** Optional: derive the connected account's email from the token payload (e.g. id_token JWT). */
  extractAccountEmail?: (tokens: OAuthTokens) => string | null;
  /** Optional: connection_metadata JSON for the activation update. Defaults to `{ auth_type: 'oauth' }`. */
  buildConnectionMetadata?: (tokens: OAuthTokens) => Record<string, unknown>;
  /** Optional: post-OAuth sanity ping. Failures are warned and swallowed (matches existing behavior). */
  testToken?: (accessToken: string) => Promise<void>;
  /** Success message returned in the JSON response. */
  successMessage: string;
  /** Optional extra keys merged into the success JSON (e.g. `webhookRegistration: 'triggered'`). */
  responseExtras?: Record<string, unknown>;
  /**
   * Optional async post-task — wrap any provider-specific follow-up here. Caller is
   * responsible for scheduling via `EdgeRuntime.waitUntil(...)` if it should not
   * block the response (Grain does this for webhook registration).
   */
  onSuccess?: (ctx: OAuthCallbackSuccessContext) => void | Promise<void>;
}

interface OAuthCallbackRequest {
  code?: string;
  state?: string;
}

/**
 * Build a `(req: Request) => Promise<Response>` handler that:
 *   1. handles CORS preflight + auth via the shared helpers,
 *   2. validates the state parameter against the pending oauth_state row,
 *   3. confirms the pending source belongs to the user + provider,
 *   4. exchanges the code for tokens via the injected exchangeToken,
 *   5. persists tokens via `persistOAuthTokens` (encrypt-aware),
 *   6. clears the oauth_state / pending_import_source_id,
 *   7. flips the import_sources row to is_active=true with provider metadata,
 *   8. fires `onSuccess` for any provider-specific post-task,
 *   9. returns the standard `{ success, message, sourceId, accountEmail, backfillTriggered, ...extras }` body.
 *
 * All boilerplate kept identical to the pre-refactor handlers so error shapes,
 * status codes, and side-effect ordering stay observationally the same.
 */
export function createOAuthCallbackHandler(
  config: CreateOAuthCallbackHandlerConfig,
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

      const { code, state } = (await req.json()) as OAuthCallbackRequest;
      if (!code || !state) {
        return json({ success: false, error: 'Missing code or state' }, 400, corsHeaders);
      }

      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('oauth_state, pending_import_source_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (settingsError) throw settingsError;

      const parsedState = parseOAuthState(config.sourceApp, settings?.oauth_state);
      if (!parsedState || parsedState.state !== state) {
        return json({ success: false, error: 'Invalid state parameter' }, 400, corsHeaders);
      }
      const sourceId = settings.pending_import_source_id;
      if (!sourceId) {
        return json(
          { success: false, error: `No pending import source found. Please connect ${config.providerLabel} again.` },
          400,
          corsHeaders,
        );
      }
      const source = await config.resolveSource(supabase, userId, sourceId);
      if (!source) {
        return json(
          { success: false, error: `Pending ${config.providerLabel} source was not found. Please connect ${config.providerLabel} again.` },
          400,
          corsHeaders,
        );
      }

      const clientId = Deno.env.get(config.clientIdEnv);
      const clientSecret = Deno.env.get(config.clientSecretEnv);
      const redirectUri = resolveRedirectUri(origin, config.redirectUriEnv, config.redirectPathSegment);
      if (!clientId || !clientSecret) {
        return json(
          {
            success: false,
            error: `${config.providerLabel} OAuth is not configured. Set ${config.clientIdEnv} and ${config.clientSecretEnv}.`,
          },
          500,
          corsHeaders,
        );
      }

      const tokens = await config.exchangeToken({
        code,
        clientId,
        clientSecret,
        redirectUri,
        codeVerifier: parsedState.codeVerifier,
      });
      const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
      await persistOAuthTokens({
        supabase,
        sourceId,
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        isActive: true,
      });

      const { error: settingsClearError } = await supabase
        .from('user_settings')
        .update({ oauth_state: null, pending_import_source_id: null })
        .eq('user_id', userId);
      if (settingsClearError) throw settingsClearError;

      const accountEmail = config.extractAccountEmail ? config.extractAccountEmail(tokens) : null;

      if (config.testToken) {
        try {
          await config.testToken(tokens.access_token);
        } catch (error) {
          console.warn(`${config.providerLabel} token test failed after OAuth callback:`, error);
        }
      }

      const connectionMetadata = config.buildConnectionMetadata
        ? config.buildConnectionMetadata(tokens)
        : { auth_type: 'oauth' };

      const { error: sourceUpdateError } = await supabase
        .from('import_sources')
        .update({
          account_email: accountEmail,
          connection_metadata: connectionMetadata,
          error_message: null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceId)
        .eq('user_id', userId);
      if (sourceUpdateError) {
        console.error(`Failed to activate ${config.providerLabel} source after OAuth:`, {
          userId,
          sourceId,
          error: sourceUpdateError,
        });
        throw new Error(`${config.providerLabel} connected, but activating the source failed. Try reconnecting.`);
      }

      if (config.onSuccess) {
        await config.onSuccess({ supabase, userId, sourceId, tokens, req });
      }

      return json(
        {
          success: true,
          message: config.successMessage,
          sourceId,
          accountEmail,
          backfillTriggered: false,
          ...(config.responseExtras ?? {}),
        },
        200,
        corsHeaders,
      );
    } catch (error) {
      console.error(`${config.providerLabel} OAuth callback error:`, error);
      return json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        500,
        corsHeaders,
      );
    }
  };
}

/**
 * Parse the `${sourceApp}:${state}:${verifier}` token written by the URL handler.
 * Returns null if the prefix doesn't match (guards against a stale state from a
 * different provider's flow).
 */
export function parseOAuthState(
  sourceApp: OAuthSourceApp,
  value: string | null | undefined,
): { state: string; codeVerifier: string } | null {
  const prefix = `${sourceApp}:`;
  if (!value?.startsWith(prefix)) return null;
  const [, state, codeVerifier] = value.split(':');
  if (!state || !codeVerifier) return null;
  return { state, codeVerifier };
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
