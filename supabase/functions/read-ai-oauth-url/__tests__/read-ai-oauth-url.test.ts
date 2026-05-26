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

describe("read-ai-oauth-url wiring", () => {
  it("wires the shared OAuth URL factory with the Read.ai provider config", () => {
    expect(source).toMatch(/createOAuthUrlHandler/);
    expect(source).toMatch(/sourceApp:\s*['"]read-ai['"]/);
    expect(source).toMatch(/resolveSource:.*resolveReadAiSource\(supabase,\s*userId,\s*sourceId\)/s);
    expect(source).toMatch(/clientIdEnv:\s*['"]READAI_OAUTH_CLIENT_ID['"]/);
    expect(source).toMatch(/ReadAiClient\.buildAuthorizationUrl/);
  });

  it("factory validates caller-provided source ids before persisting OAuth state", () => {
    expect(factorySource).toMatch(/config\.resolveSource\(supabase,\s*userId,\s*requestedSourceId\)/);
    expect(factorySource.indexOf("config.resolveSource"))
      .toBeLessThan(factorySource.indexOf("pending_import_source_id"));
  });

  it("factory returns a startup error when OAuth state persistence fails", () => {
    expect(factorySource).toMatch(/settingsError/);
    expect(factorySource).toMatch(/Failed to start \$\{config\.providerLabel\} OAuth\. Try again\./);
    expect(source).toMatch(/providerLabel:\s*['"]Read\.ai['"]/);
  });
});
