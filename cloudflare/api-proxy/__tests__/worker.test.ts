/**
 * Cloudflare Worker route resolution tests against the live worker.ts
 * (not a photocopied resolveTarget).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { resolveTarget } from "../worker";

const SUPABASE_BASE = "https://vltmrnjsubfzrgrtdqey.supabase.co";

function apiUrl(path: string): URL {
  return new URL(`https://api.callvaultai.com${path}`);
}

function mcpUrl(path: string): URL {
  return new URL(`https://mcp.callvaultai.com${path}`);
}

describe("REST API /v1/* routing", () => {
  it("/v1/calls routes to callvault-api", () => {
    const route = resolveTarget(apiUrl("/v1/calls"));
    expect(route?.target).toBe(`${SUPABASE_BASE}/functions/v1/callvault-api/v1/calls`);
    expect(route?.publicPath).toBe("/v1/calls");
  });

  it("preserves query string on /v1/* routes", () => {
    const route = resolveTarget(apiUrl("/v1/calls?limit=10"));
    expect(route?.target).toContain("limit=10");
  });

  it("bare /v1 routes to callvault-api", () => {
    const route = resolveTarget(apiUrl("/v1"));
    expect(route?.target).toContain("/functions/v1/callvault-api/v1");
  });
});

describe("/auth/v1/* is not swallowed by /v1/*", () => {
  it("/auth/v1/oauth/token goes to Supabase Auth", () => {
    const route = resolveTarget(apiUrl("/auth/v1/oauth/token"));
    expect(route?.target).toBe(`${SUPABASE_BASE}/auth/v1/oauth/token`);
    expect(route?.target).not.toContain("callvault-api");
  });

  it("/auth/v1/oauth/authorize goes to Supabase Auth", () => {
    const route = resolveTarget(apiUrl("/auth/v1/oauth/authorize"));
    expect(route?.target).toContain(`${SUPABASE_BASE}/auth/v1/oauth/authorize`);
    expect(route?.target).not.toContain("callvault-api");
  });
});

describe("MCP routing", () => {
  it("/mcp routes to mcp-server", () => {
    const route = resolveTarget(apiUrl("/mcp"));
    expect(route?.target).toBe(`${SUPABASE_BASE}/functions/v1/mcp-server`);
  });

  it("mcp.callvaultai.com root routes to mcp-server", () => {
    const route = resolveTarget(mcpUrl("/"));
    expect(route?.target).toBe(`${SUPABASE_BASE}/functions/v1/mcp-server`);
  });

  it("well-known authorization-server routes to mcp-oauth-metadata", () => {
    const route = resolveTarget(apiUrl("/.well-known/oauth-authorization-server"));
    expect(route?.target).toContain("mcp-oauth-metadata");
    expect(route?.target).toContain("doc=authorization-server");
  });

  it("workspace well-known protected-resource path is forwarded", () => {
    const ws = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const route = resolveTarget(
      apiUrl(`/.well-known/oauth-protected-resource/mcp/w/${ws}`),
    );
    expect(route?.target).toContain("resource_path=");
    expect(route?.target).toContain(encodeURIComponent(`/mcp/w/${ws}`));
  });
});

describe("unmatched paths", () => {
  it("/unknown returns null", () => {
    expect(resolveTarget(apiUrl("/unknown"))).toBeNull();
  });
});

describe("oauth authorize query allowlist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips redirect_to before forwarding authorize to Auth", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "https://api.callvaultai.com/auth/v1/oauth/authorize?client_id=abc&redirect_to=https://evil.example&state=s",
    );
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);

    const forwarded = fetchMock.mock.calls[0][0] as Request;
    const forwardedUrl = new URL(forwarded.url);
    expect(forwardedUrl.origin + forwardedUrl.pathname).toBe(
      `${SUPABASE_BASE}/auth/v1/oauth/authorize`,
    );
    expect(forwardedUrl.searchParams.get("client_id")).toBe("abc");
    expect(forwardedUrl.searchParams.get("state")).toBe("s");
    expect(forwardedUrl.searchParams.has("redirect_to")).toBe(false);
  });
});
