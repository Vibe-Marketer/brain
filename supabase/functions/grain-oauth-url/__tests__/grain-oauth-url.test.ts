import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const factorySource = readFileSync(
  join(__dirname, "../../_shared/oauth-url-handler.ts"),
  "utf8",
);

describe("grain-oauth-url wiring", () => {
  it("wires the shared OAuth URL factory with the Grain provider config", () => {
    expect(source).toMatch(/createOAuthUrlHandler/);
    expect(source).toMatch(/sourceApp:\s*['"]grain['"]/);
    expect(source).toMatch(/resolveSource:.*resolveGrainSource\(supabase,\s*userId,\s*sourceId\)/s);
    expect(source).toMatch(/clientIdEnv:\s*['"]GRAIN_OAUTH_CLIENT_ID['"]/);
    expect(source).toMatch(/redirectPathSegment:\s*['"]grain['"]/);
    expect(source).toMatch(/GrainClient\.buildAuthorizationUrl/);
  });

  it("factory validates caller-provided source ids before persisting OAuth state", () => {
    expect(factorySource).toMatch(/config\.resolveSource\(supabase,\s*userId,\s*requestedSourceId\)/);
    expect(factorySource.indexOf("config.resolveSource"))
      .toBeLessThan(factorySource.indexOf("pending_import_source_id"));
  });

  it("factory returns a startup error when OAuth state persistence fails", () => {
    expect(factorySource).toMatch(/settingsError/);
    expect(factorySource).toMatch(/Failed to start \$\{config\.providerLabel\} OAuth\. Try again\./);
  });

  it("factory resolves callback URLs for local and production origins", () => {
    expect(factorySource).toMatch(/function resolveRedirectUri/);
    expect(factorySource).toContain("http://127.0.0.1:8080");
    expect(factorySource).toContain("http://localhost:8080");
    expect(factorySource).toContain("https://app.callvaultai.com");
    expect(source).toMatch(/redirectPathSegment:\s*['"]grain['"]/);
  });
});
