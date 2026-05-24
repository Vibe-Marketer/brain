import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("grain-oauth-url wiring", () => {
  it("validates caller-provided source ids before persisting OAuth state", () => {
    expect(source).toMatch(/resolveGrainSource\(supabase,\s*userId,\s*requestedSourceId\)/);
    expect(source.indexOf("resolveGrainSource")).toBeLessThan(source.indexOf("pending_import_source_id"));
  });

  it("returns a startup error when OAuth state persistence fails", () => {
    expect(source).toMatch(/settingsError/);
    expect(source).toMatch(/Failed to start Grain OAuth\. Try again\./);
  });
});
