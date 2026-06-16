/**
 * *.callvaultai.com — MCP subdomain routing Worker.
 *
 * Routes per-org and per-workspace MCP subdomains to the existing Supabase Edge
 * Functions while injecting authoritative slug headers. Because Cloudflare's
 * wildcard route also matches api.callvaultai.com and mcp.callvaultai.com, this
 * Worker includes a reserved-host passthrough for the legacy public surfaces.
 */

export interface Env {
  CALLVAULT_INTERNAL_SECRET: string;
}

const SUPABASE_BASE = "https://vltmrnjsubfzrgrtdqey.supabase.co";
const SLUG_REGEX = /^[a-z0-9]+$/;
const LEGACY_PROXY_HOSTS = new Set(["api.callvaultai.com", "mcp.callvaultai.com"]);

const RESERVED_SUBDOMAINS = new Set([
  "app",
  "api",
  "mcp",
  "www",
  "mail",
  "smtp",
  "ftp",
  "docs",
  "status",
  "admin",
  "dashboard",
  "staging",
  "dev",
  "beta",
  "preview",
]);

const STRIP_REQUEST_HEADERS = [
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "x-forwarded-for",
  "x-forwarded-host",
];

const STRIP_INBOUND_CALLVAULT_HEADERS = [
  "x-callvault-org-slug",
  "x-callvault-workspace-slug",
  "x-callvault-internal-secret",
  "x-callvault-scope",
  "x-callvault-host",
  "x-callvault-public-path",
];

const STRIP_RESPONSE_HEADERS = ["x-sb-edge-region", "x-sb-gateway-version"];

const OAUTH_ALLOWLISTED_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
];

type SlugScope = {
  orgSlug: string;
  wsSlug: string | null;
};

type ResolvedRoute = {
  target: string;
  publicPath: string;
  isJsonRpc: boolean;
};

async function uniformNotFound(): Promise<Response> {
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

function extractSlugScope(url: URL): SlugScope | null {
  const suffix = ".callvaultai.com";
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(suffix)) return null;

  const subdomain = hostname.slice(0, hostname.length - suffix.length);
  if (!subdomain || subdomain.includes(".") || RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  const hyphenIdx = subdomain.indexOf("-");
  const orgSlug = hyphenIdx === -1 ? subdomain : subdomain.slice(0, hyphenIdx);
  const wsSlug = hyphenIdx === -1 ? null : subdomain.slice(hyphenIdx + 1);

  if (!SLUG_REGEX.test(orgSlug)) return null;
  if (wsSlug !== null && !SLUG_REGEX.test(wsSlug)) return null;

  return { orgSlug, wsSlug };
}

function resolveSubdomainRoute(url: URL): ResolvedRoute | null {
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    const tail = url.pathname.slice(4);
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`,
      publicPath: "/mcp",
      isJsonRpc: true,
    };
  }

  if (url.pathname === "/mcp-register") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-register${url.search}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname.startsWith("/auth/v1/")) {
    return {
      target: `${SUPABASE_BASE}${buildAuthPath(url)}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent("/mcp")}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  // RFC 9728 path-insertion form: the MCP server's WWW-Authenticate points clients
  // at /.well-known/oauth-protected-resource/mcp (resource path appended). Without
  // this route the subdomain Worker 404s the discovery URL Claude follows after the
  // 401, and the client reports "couldn't connect to a valid MCP server".
  if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent("/mcp")}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname.startsWith("/.well-known/oauth-protected-resource/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent("/mcp")}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/openid-configuration") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=openid-configuration`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  return null;
}

function buildAuthPath(url: URL): string {
  if (url.pathname !== "/auth/v1/oauth/authorize") {
    return `${url.pathname}${url.search}`;
  }

  const filteredSearch = new URLSearchParams();
  for (const param of OAUTH_ALLOWLISTED_PARAMS) {
    const val = url.searchParams.get(param);
    if (val !== null) filteredSearch.set(param, val);
  }

  const filteredSearchStr = filteredSearch.toString();
  return `/auth/v1/oauth/authorize${filteredSearchStr ? `?${filteredSearchStr}` : ""}`;
}

function upstreamErrorResponse(isJsonRpc: boolean): Response {
  const body = isJsonRpc
    ? { jsonrpc: "2.0", error: { code: -32603, message: "Upstream proxy error" }, id: null }
    : { error: "Upstream proxy error" };

  return new Response(JSON.stringify(body), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (LEGACY_PROXY_HOSTS.has(url.hostname)) {
      return proxyLegacyHost(request, env, url);
    }

    const scope = extractSlugScope(url);
    if (!scope) return uniformNotFound();

    const route = resolveSubdomainRoute(url);
    if (!route) return uniformNotFound();

    return proxyToUpstream(request, env, url, route, scope);
  },
};

async function proxyToUpstream(
  request: Request,
  env: Env,
  url: URL,
  route: ResolvedRoute,
  scope: SlugScope,
): Promise<Response> {
  const forwardHeaders = buildForwardHeaders(request, env, url, route.publicPath);
  forwardHeaders.set("x-callvault-org-slug", scope.orgSlug);
  forwardHeaders.set("x-callvault-scope", scope.wsSlug ? "workspace" : "org");
  if (scope.wsSlug) forwardHeaders.set("x-callvault-workspace-slug", scope.wsSlug);

  const response = await fetchUpstream(request, route, forwardHeaders);

  // Bridge the subdomain scope to the OAuth consent page. The consent screen
  // lives on app.callvaultai.com and only receives an authorization_id; Supabase's
  // getAuthorizationDetails does NOT return the resource/subdomain (verified
  // 2026-06-16 — response carries only authorization_id, redirect_uri (the
  // client's callback), client, user, scope). The /auth/v1/oauth/authorize hop is
  // a user-browser navigation through this Worker, so we stamp the org[-workspace]
  // slug into a short-lived, parent-domain cookie the consent page can read to
  // pre-pin (and lock) the org/workspace. Not HttpOnly so the consent page JS can
  // read it; contains only public slugs and is re-validated against the user's
  // real orgs before anything is granted.
  if (url.pathname === "/auth/v1/oauth/authorize") {
    const scopeLabel = scope.wsSlug ? `${scope.orgSlug}-${scope.wsSlug}` : scope.orgSlug;
    const headers = new Headers(response.headers);
    headers.append(
      "Set-Cookie",
      `cv_oauth_scope=${scopeLabel}; Domain=.callvaultai.com; Path=/; Max-Age=600; SameSite=Lax`,
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}

async function proxyLegacyHost(request: Request, env: Env, url: URL): Promise<Response> {
  let route = resolveLegacyRoute(url);
  if (!route) return uniformNotFound();

  if (url.pathname === "/auth/v1/oauth/authorize") {
    route = { ...route, target: `${SUPABASE_BASE}${buildAuthPath(url)}` };
  }

  const response = await fetchUpstream(
    request,
    route,
    buildForwardHeaders(request, env, url, route.publicPath),
  );

  if (!isDeprecatedMcpRoute(url)) return response;

  const headers = new Headers(response.headers);
  headers.set("Deprecation", "true");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildForwardHeaders(
  request: Request,
  env: Env,
  url: URL,
  publicPath: string,
): Headers {
  const forwardHeaders = new Headers(request.headers);
  const realIp = request.headers.get("CF-Connecting-IP");

  for (const h of STRIP_REQUEST_HEADERS) forwardHeaders.delete(h);
  for (const h of STRIP_INBOUND_CALLVAULT_HEADERS) forwardHeaders.delete(h);

  if (realIp) forwardHeaders.set("x-forwarded-for", realIp);
  forwardHeaders.set("x-forwarded-host", url.hostname);
  forwardHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));
  forwardHeaders.set("x-callvault-host", url.hostname);
  forwardHeaders.set("x-callvault-public-path", publicPath);
  forwardHeaders.set("x-callvault-internal-secret", env.CALLVAULT_INTERNAL_SECRET);

  return forwardHeaders;
}

async function fetchUpstream(
  request: Request,
  route: ResolvedRoute,
  forwardHeaders: Headers,
): Promise<Response> {
  forwardHeaders.set("host", new URL(route.target).host);

  let upstream: Response;
  try {
    upstream = await fetch(new Request(route.target, {
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: "manual",
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mcp-subdomain-worker] upstream fetch failed: ${route.target} — ${message}`);
    return upstreamErrorResponse(route.isJsonRpc);
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const h of STRIP_RESPONSE_HEADERS) responseHeaders.delete(h);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

function resolveLegacyRoute(url: URL): ResolvedRoute | null {
  if (url.hostname === "mcp.callvaultai.com" && url.pathname === "/") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${url.search}`,
      publicPath: "/",
      isJsonRpc: true,
    };
  }

  const rootWorkspaceMatch = url.pathname.match(/^\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (url.hostname === "mcp.callvaultai.com" && rootWorkspaceMatch) {
    const workspacePath = `/w/${rootWorkspaceMatch[1].toLowerCase()}`;
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${workspacePath}${url.search}`,
      publicPath: workspacePath,
      isJsonRpc: true,
    };
  }

  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    const tail = url.pathname.slice(4);
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`,
      publicPath: url.pathname,
      isJsonRpc: true,
    };
  }

  if (url.pathname === "/mcp-register") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-register${url.search}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/oauth-protected-resource") {
    const defaultResourcePath = url.hostname === "mcp.callvaultai.com" ? "/" : "/mcp";
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent(defaultResourcePath)}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent("/mcp")}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname.startsWith("/.well-known/oauth-protected-resource/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/oauth-authorization-server" || url.pathname.startsWith("/.well-known/oauth-authorization-server/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/.well-known/openid-configuration") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=openid-configuration`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname.startsWith("/auth/v1/")) {
    return {
      target: `${SUPABASE_BASE}${url.pathname}${url.search}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/callvault-api${url.pathname}${url.search}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/fireflies-webhook" || url.pathname.startsWith("/fireflies-webhook/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1${url.pathname}${url.search}`,
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  if (url.pathname === "/logo.png") {
    return {
      target: "https://app.callvaultai.com/logo.png",
      publicPath: url.pathname,
      isJsonRpc: false,
    };
  }

  return null;
}

function isDeprecatedMcpRoute(url: URL): boolean {
  if (url.hostname === "mcp.callvaultai.com") return true;
  return url.pathname === "/mcp" || url.pathname.startsWith("/mcp/");
}
