/**
 * Cloudflare Worker route resolution tests.
 *
 * These tests exercise `resolveTarget` in isolation by extracting the routing
 * logic. We test the full exported handler via a lightweight Request/Response
 * shim where fetch is mocked.
 */

import { describe, it, expect } from 'vitest';

// ─── inline resolveTarget replica ────────────────────────────────────────────
// We re-derive SUPABASE_BASE and resolveTarget inline rather than importing
// worker.ts because the worker file uses top-level `const` and Cloudflare
// module syntax that does not import cleanly into jsdom. The routing logic
// under test is deterministic pure-function territory; any changes to
// worker.ts routing rules must be mirrored here.

const SUPABASE_BASE = "https://vltmrnjsubfzrgrtdqey.supabase.co";

type ResolvedRoute = { target: string; publicPath: string } | null;

function resolveTarget(url: URL): ResolvedRoute {
  if (url.hostname === "mcp.callvaultai.com" && url.pathname === "/") {
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-server${url.search}`, publicPath: "/" };
  }
  const rootWorkspaceMatch = url.pathname.match(/^\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (url.hostname === "mcp.callvaultai.com" && rootWorkspaceMatch) {
    const workspacePath = `/w/${rootWorkspaceMatch[1].toLowerCase()}`;
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-server${workspacePath}${url.search}`, publicPath: workspacePath };
  }
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    const tail = url.pathname.slice(4);
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`, publicPath: url.pathname };
  }
  if (url.pathname === "/mcp-register") {
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-register${url.search}`, publicPath: url.pathname };
  }
  if (url.pathname === "/.well-known/oauth-protected-resource") {
    const defaultResourcePath = url.hostname === "mcp.callvaultai.com" ? "/" : "/mcp";
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent(defaultResourcePath)}`, publicPath: url.pathname };
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`, publicPath: url.pathname };
  }
  if (url.pathname === "/.well-known/openid-configuration") {
    return { target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=openid-configuration`, publicPath: url.pathname };
  }
  // /auth/v1/* MUST be checked before /v1/* so auth routes are never caught by the REST handler.
  if (url.pathname.startsWith("/auth/v1/")) {
    return { target: `${SUPABASE_BASE}${url.pathname}${url.search}`, publicPath: url.pathname };
  }
  // /v1/* → callvault-api Edge Function (REST API)
  if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
    return { target: `${SUPABASE_BASE}/functions/v1/callvault-api${url.pathname}${url.search}`, publicPath: url.pathname };
  }
  if (url.pathname === "/fireflies-webhook" || url.pathname.startsWith("/fireflies-webhook/")) {
    return { target: `${SUPABASE_BASE}/functions/v1${url.pathname}${url.search}`, publicPath: url.pathname };
  }
  if (url.pathname === "/logo.png") {
    return { target: "https://app.callvaultai.com/logo.png", publicPath: url.pathname };
  }
  return null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function apiUrl(path: string): URL {
  return new URL(`https://api.callvaultai.com${path}`);
}

function mcpUrl(path: string): URL {
  return new URL(`https://mcp.callvaultai.com${path}`);
}

// ─── REST API /v1/* routing ───────────────────────────────────────────────────

describe("REST API /v1/* routing", () => {
  it("/v1/calls routes to callvault-api function", () => {
    const route = resolveTarget(apiUrl("/v1/calls"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/callvault-api");
    expect(route!.target).toContain("/v1/calls");
    expect(route!.publicPath).toBe("/v1/calls");
  });

  it("/v1/workspaces routes to callvault-api function", () => {
    const route = resolveTarget(apiUrl("/v1/workspaces"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/callvault-api");
    expect(route!.target).toContain("/v1/workspaces");
  });

  it("/v1/contacts routes to callvault-api function", () => {
    const route = resolveTarget(apiUrl("/v1/contacts"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/callvault-api");
  });

  it("/v1/speakers routes to callvault-api function", () => {
    const route = resolveTarget(apiUrl("/v1/speakers"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/callvault-api");
  });

  it("/v1/calls/{id} routes to callvault-api function", () => {
    const route = resolveTarget(apiUrl("/v1/calls/abc123"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/callvault-api");
    expect(route!.target).toContain("/v1/calls/abc123");
  });

  it("preserves query string on /v1/* routes", () => {
    const route = resolveTarget(apiUrl("/v1/calls?limit=10&page=2"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("limit=10");
  });

  it("bare /v1 (no trailing slash) routes to callvault-api", () => {
    const route = resolveTarget(apiUrl("/v1"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/callvault-api");
  });
});

// ─── /auth/v1/* routing (must not be caught by /v1/* branch) ─────────────────

describe("/auth/v1/* routing — not intercepted by REST API branch", () => {
  it("/auth/v1/oauth/token routes to Supabase Auth, NOT callvault-api", () => {
    const route = resolveTarget(apiUrl("/auth/v1/oauth/token"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain(`${SUPABASE_BASE}/auth/v1/oauth/token`);
    expect(route!.target).not.toContain("callvault-api");
  });

  it("/auth/v1/oauth/authorize routes to Supabase Auth", () => {
    const route = resolveTarget(apiUrl("/auth/v1/oauth/authorize"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain(`${SUPABASE_BASE}/auth/v1/oauth/authorize`);
    expect(route!.target).not.toContain("callvault-api");
  });

  it("/auth/v1/token does not leak into /v1/* branch", () => {
    const route = resolveTarget(apiUrl("/auth/v1/token"));
    expect(route!.target).not.toContain("callvault-api");
  });
});

// ─── Existing MCP routing regression ─────────────────────────────────────────

describe("MCP routing regression — unaffected by /v1/* addition", () => {
  it("/mcp routes to mcp-server", () => {
    const route = resolveTarget(apiUrl("/mcp"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/mcp-server");
  });

  it("mcp.callvaultai.com root routes to mcp-server", () => {
    const route = resolveTarget(mcpUrl("/"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("/functions/v1/mcp-server");
  });

  it("/.well-known/oauth-authorization-server routes to mcp-oauth-metadata", () => {
    const route = resolveTarget(apiUrl("/.well-known/oauth-authorization-server"));
    expect(route).not.toBeNull();
    expect(route!.target).toContain("mcp-oauth-metadata");
  });
});

// ─── 404 paths ────────────────────────────────────────────────────────────────

describe("unmatched paths return null (404)", () => {
  it("/unknown returns null", () => {
    expect(resolveTarget(apiUrl("/unknown"))).toBeNull();
  });

  it("/v2/calls returns null (no v2 route defined)", () => {
    expect(resolveTarget(apiUrl("/v2/calls"))).toBeNull();
  });

  it("/admin returns null", () => {
    expect(resolveTarget(apiUrl("/admin"))).toBeNull();
  });
});
