import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_REGISTRY } from "@/config/source-registry";
import {
  getConnectorAdapter,
  isKnownSourceApp,
} from "@/components/connectors/registry/connectorRegistry";
import { getConnectorCapabilities } from "@/lib/connector-capabilities";

const repoRoot = process.cwd();

describe("connector lifecycle readiness", () => {
  it("keeps each native connector ready for its declared lifecycle states", () => {
    for (const source of SOURCE_REGISTRY.filter((entry) => entry.adapter === "native")) {
      expect(isKnownSourceApp(source.id), `${source.id} has no connector adapter`).toBe(true);
      const adapter = getConnectorAdapter(source.id);
      const capabilities = getConnectorCapabilities(adapter);

      expect(adapter.metadata.sourceApp).toBe(source.id);
      expect(adapter.metadata.label).toBe(source.label);

      if (source.authMode === "oauth2") {
        expect(adapter.setup.kind, `${source.id} OAuth connector must use shared OAuth setup`).toBe("oauth");
        expect(adapter.metadata.authMethods).toContain("oauth");
        expect(adapter.getOAuthAuthUrl, `${source.id} cannot start OAuth`).toBeTypeOf("function");
        expect(source.oauthUrlFunctionName, `${source.id} missing OAuth URL function metadata`).toBeDefined();
        expect(source.oauthCallbackFunctionName, `${source.id} missing OAuth callback function metadata`).toBeDefined();
      }

      if (source.authMode === "api-key" || source.authMode === "token-paste") {
        expect(adapter.saveApiKeyCredentials, `${source.id} cannot save token/API credentials`).toBeTypeOf("function");
        expect(adapter.setup.credentialFields?.length ?? 0, `${source.id} has no credential setup fields`).toBeGreaterThan(0);
      }

      if (source.authMode !== "public-url") {
        expect(adapter.disconnect, `${source.id} cannot disconnect`).toBeTypeOf("function");
      }

      if (source.syncFunctionName && source.authMode !== "public-url") {
        expect(capabilities.canSearchAvailable, `${source.id} cannot search available calls`).toBe(true);
        expect(capabilities.canImportSelected, `${source.id} cannot selectively import calls`).toBe(true);
      }

      if (source.hasWebhook) {
        expect(source.webhookFunctionName, `${source.id} has webhook=true without webhook function metadata`).toBeDefined();
        expect(
          existsSync(join(repoRoot, "supabase/functions", source.webhookFunctionName!, "index.ts")),
          `${source.id} webhook function is not deployable`,
        ).toBe(true);
      } else {
        expect(source.webhookFunctionName, `${source.id} should not declare webhook receiver metadata`).toBeUndefined();
      }
    }
  });

  it("documents the intentional Plaud exception without letting it leak into normal OAuth setup", () => {
    const plaud = SOURCE_REGISTRY.find((source) => source.id === "plaud");
    const adapter = getConnectorAdapter("plaud");

    expect(plaud).toMatchObject({
      authMode: "token-paste",
      oauthUrlFunctionName: "plaud-oauth-url",
      oauthCallbackFunctionName: "plaud-oauth-callback",
    });
    expect(adapter.setup.kind).toBe("browser_bridge");
    expect(adapter.metadata.authMethods).not.toContain("oauth");
    expect(adapter.getOAuthAuthUrl).toBeUndefined();
  });
});
