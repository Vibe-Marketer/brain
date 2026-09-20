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

  it("factory validates the pending source via resolveSource before persisting tokens", () => {
    expect(factorySource).toMatch(/config\.resolveSource\(supabase,\s*userId,\s*sourceId\)/);
    // Resolve must happen before the persist call site (skip the import statement
    // by anchoring on the call form `persistOAuthTokens({`).
    expect(factorySource.indexOf("config.resolveSource"))
      .toBeLessThan(factorySource.indexOf("persistOAuthTokens({"));
  });

});
