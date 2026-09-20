import { describe, expect, it } from "vitest";
import {
  buildAuthPath,
  extractSlugScope,
  resolveSubdomainRoute,
} from "../worker";

describe("extractSlugScope", () => {
  it("parses an org-only subdomain", () => {
    expect(extractSlugScope(new URL("https://acme.callvaultai.com/mcp"))).toEqual({
      orgSlug: "acme",
      wsSlug: null,
    });
  });

  it("parses org-workspace hyphenated subdomain", () => {
    expect(
      extractSlugScope(new URL("https://acme-sales.callvaultai.com/mcp")),
    ).toEqual({ orgSlug: "acme", wsSlug: "sales" });
  });

  it("rejects reserved hosts (api/mcp/app)", () => {
    expect(extractSlugScope(new URL("https://api.callvaultai.com/mcp"))).toBeNull();
    expect(extractSlugScope(new URL("https://mcp.callvaultai.com/mcp"))).toBeNull();
    expect(extractSlugScope(new URL("https://app.callvaultai.com/mcp"))).toBeNull();
  });

  it("rejects invalid slug characters", () => {
    expect(
      extractSlugScope(new URL("https://acme_x.callvaultai.com/mcp")),
    ).toBeNull();
  });
});

describe("resolveSubdomainRoute", () => {
  it("/mcp routes to mcp-server", () => {
    const route = resolveSubdomainRoute(new URL("https://acme.callvaultai.com/mcp"));
    expect(route?.target).toContain("/functions/v1/mcp-server");
    expect(route?.isJsonRpc).toBe(true);
  });

  it("well-known /mcp protected-resource is not 404", () => {
    const route = resolveSubdomainRoute(
      new URL("https://acme.callvaultai.com/.well-known/oauth-protected-resource/mcp"),
    );
    expect(route?.target).toContain("mcp-oauth-metadata");
    expect(route?.target).toContain("resource_path=");
  });
});

describe("buildAuthPath", () => {
  it("strips redirect_to from authorize", () => {
    const path = buildAuthPath(
      new URL(
        "https://acme.callvaultai.com/auth/v1/oauth/authorize?client_id=abc&redirect_to=https://evil.example",
      ),
    );
    expect(path).toContain("/auth/v1/oauth/authorize");
    expect(path).toContain("client_id=abc");
    expect(path).not.toContain("redirect_to");
  });
});
