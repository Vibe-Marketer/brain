import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const factorySource = readFileSync(
  join(__dirname, "../../_shared/oauth-callback-handler.ts"),
  "utf8",
);

describe("read-ai-oauth-callback wiring", () => {
  it("wires the shared OAuth callback factory with the Read.ai provider config", () => {
    expect(source).toMatch(/createOAuthCallbackHandler/);
    expect(source).toMatch(/sourceApp:\s*['"]read-ai['"]/);
    expect(source).toMatch(/resolveSource:.*resolveReadAiSource\(supabase,\s*userId,\s*sourceId\)/s);
    expect(source).toMatch(/ReadAiClient\.exchangeCodeForTokens/);
  });

  it("factory validates the pending source via resolveSource before persisting tokens", () => {
    expect(factorySource).toMatch(/config\.resolveSource\(supabase,\s*userId,\s*sourceId\)/);
    // Resolve must happen before the persist call site (skip the import statement
    // by anchoring on the call form `persistOAuthTokens({`).
    expect(factorySource.indexOf("config.resolveSource"))
      .toBeLessThan(factorySource.indexOf("persistOAuthTokens({"));
  });

  it("factory checks state clearing and source activation failures", () => {
    expect(factorySource).toMatch(/settingsClearError/);
    expect(factorySource).toMatch(/sourceUpdateError/);
    expect(factorySource).toMatch(/connected, but activating the source failed/);
    expect(source).toMatch(/providerLabel:\s*['"]Read\.ai['"]/);
  });

  it("does not backfill historical Read.ai meetings after successful connection", () => {
    expect(source).not.toMatch(/supabase\.functions\.invoke\(['"]read-ai-sync-meetings['"]/);
    expect(factorySource).toMatch(/backfillTriggered:\s*false/);
    expect(source).toMatch(/Select meetings to import/);
  });
});
