import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OAUTH_CALLBACK_ROUTES,
  resolveOAuthCallbackRoute,
} from "@/lib/oauth-callback-routing";
import { SOURCE_REGISTRY } from "@/config/source-registry";

describe("oauth callback routing", () => {
  const repoRoot = process.cwd();

  it.each([
    ["/oauth/callback", "fathom", "Fathom"],
    ["/oauth/callback/", "fathom", "Fathom"],
    ["/oauth/callback/zoom", "zoom", "Zoom"],
    ["/oauth/callback/plaud", "plaud", "Plaud"],
    ["/oauth/callback/read-ai", "read-ai", "Read.ai"],
    ["/oauth/callback/grain", "grain", "Grain"],
  ])("resolves %s", (path, sourceApp, label) => {
    const route = resolveOAuthCallbackRoute(path);

    expect(route.sourceApp).toBe(sourceApp);
    expect(route.label).toBe(label);
  });

  it("defaults unknown callback paths to the legacy Fathom callback", () => {
    expect(resolveOAuthCallbackRoute("/oauth/callback/unknown").sourceApp).toBe(
      "fathom",
    );
  });

  it("derives OAuth callback routes from source registry entries with callback handlers", () => {
    expect(OAUTH_CALLBACK_ROUTES.map((route) => route.sourceApp)).toEqual([
      "fathom",
      "zoom",
      "read-ai",
      "grain",
      "plaud",
    ]);

    for (const route of OAUTH_CALLBACK_ROUTES) {
      const source = SOURCE_REGISTRY.find((entry) => entry.id === route.sourceApp);
      expect(source).toBeDefined();
      expect(route.label).toBe(source?.label);
      expect(route.pathSuffix).toBe(
        route.sourceApp === "fathom" ? "" : `/${route.sourceApp}`,
      );
    }
  });

});
