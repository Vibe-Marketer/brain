import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("grain-oauth-callback wiring", () => {
  it("validates the pending source is owned by the user and is a Grain source before storing tokens", () => {
    expect(source).toMatch(/resolveGrainSource\(supabase,\s*userId,\s*sourceId\)/);
    expect(source.indexOf("resolveGrainSource")).toBeLessThan(source.indexOf("storeTokens"));
  });

  it("checks state clearing and source activation failures", () => {
    expect(source).toMatch(/settingsClearError/);
    expect(source).toMatch(/sourceUpdateError/);
    expect(source).toMatch(/Grain connected, but activating the source failed/);
  });

  it("starts initial Grain sync after successful connection", () => {
    expect(source).toMatch(/supabase\.functions\.invoke\('grain-sync-recordings'/);
    expect(source).toMatch(/body:\s*\{\s*sourceId\s*\}/);
  });
});
