import {
  completeConnectorOAuth,
  type ApiResponse,
} from "@/lib/api-client";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";
import { getSourceConfig, SOURCE_REGISTRY } from "@/config/source-registry";

interface OAuthCallbackData {
  sourceId?: string;
  accountEmail?: string;
}

type CompleteOAuth = (
  code: string,
  state: string,
) => Promise<ApiResponse<OAuthCallbackData>>;

type OAuthCallbackSourceApp = Extract<
  ConnectorSourceApp,
  "fathom" | "zoom" | "plaud" | "read-ai" | "grain"
>;

export interface OAuthCallbackRoute {
  sourceApp: OAuthCallbackSourceApp;
  label: string;
  pathSuffix: string;
  completeOAuth: CompleteOAuth;
}

export const OAUTH_CALLBACK_ROUTES: readonly OAuthCallbackRoute[] =
  SOURCE_REGISTRY.filter((source): source is typeof source & {
    id: OAuthCallbackSourceApp;
  } => Boolean(source.oauthCallbackFunctionName))
    .map((source) => ({
      sourceApp: source.id,
      label: getSourceConfig(source.id).label,
      pathSuffix: source.id === "fathom" ? "" : `/${source.id}`,
      completeOAuth: (code, state) =>
        completeConnectorOAuth(source.id, code, state),
    }));

/**
 * Pre-resolved legacy-Fathom fallback used when an unknown callback path
 * arrives. Computed once at module init so the resolver doesn't have to
 * convince TypeScript at every call that a non-null route exists. Throws
 * loudly if the OAuth callback registry is ever empty — that would mean
 * every connector lost its oauthCallbackFunctionName, which is a config
 * bug we want to surface immediately, not paper over with `as`-casts.
 */
const FALLBACK_ROUTE: OAuthCallbackRoute = (() => {
  const r =
    OAUTH_CALLBACK_ROUTES.find((candidate) => candidate.sourceApp === "fathom") ??
    OAUTH_CALLBACK_ROUTES[0];
  if (!r) {
    throw new Error(
      "OAUTH_CALLBACK_ROUTES is empty — no source registry entries declare oauthCallbackFunctionName",
    );
  }
  return r;
})();

export function resolveOAuthCallbackRoute(pathname: string): OAuthCallbackRoute {
  const normalizedPath = pathname.replace(/\/+$/, "");
  const route = OAUTH_CALLBACK_ROUTES.find(
    (candidate) =>
      candidate.pathSuffix !== "" &&
      normalizedPath.endsWith(`/oauth/callback${candidate.pathSuffix}`),
  );

  return route ?? FALLBACK_ROUTE;
}
