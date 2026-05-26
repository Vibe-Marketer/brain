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

describe("grain-oauth-callback wiring", () => {
  it("wires the shared OAuth callback factory with the Grain provider config", () => {
    expect(source).toMatch(/createOAuthCallbackHandler/);
    expect(source).toMatch(/sourceApp:\s*['"]grain['"]/);
    expect(source).toMatch(/resolveSource:.*resolveGrainSource\(supabase,\s*userId,\s*sourceId\)/s);
    expect(source).toMatch(/GrainClient\.exchangeCodeForTokens/);
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
    expect(source).toMatch(/providerLabel:\s*['"]Grain['"]/);
  });

  it("does not backfill historical Grain recordings after successful connection", () => {
    expect(source).not.toMatch(/supabase\.functions\.invoke\('grain-sync-recordings'/);
    expect(factorySource).toMatch(/backfillTriggered:\s*false/);
    expect(source).toMatch(/Select recordings to import/);
  });

  it("keeps Grain webhook registration for future automatic sync", () => {
    // Tolerate the dot-chained `.functions\n      .invoke(...)` formatting prettier produces.
    expect(source).toMatch(/supabase\.functions\s*\.\s*invoke\(['"]grain-create-webhooks['"]/);
    expect(source).toMatch(/webhookRegistration:\s*['"]triggered['"]/);
    expect(source).toMatch(/EdgeRuntime\.waitUntil\(webhookTask\)/);
  });

  it("factory uses the same redirect URL resolver as the authorization start", () => {
    expect(factorySource).toMatch(/resolveRedirectUri\(origin/);
    expect(source).toMatch(/redirectPathSegment:\s*['"]grain['"]/);
  });
});
