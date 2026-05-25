import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("read-ai-connect-token wiring", () => {
  it("validates pasted tokens against a user-owned Read.ai source before storing credentials", () => {
    expect(source).toMatch(/resolveReadAiSource\(supabase,\s*userId,\s*sourceId\)/);
    expect(source.indexOf("resolveSourceId")).toBeLessThan(source.indexOf("storeAccessToken"));
  });

  it("returns not found for caller-provided non-Read.ai source ids", () => {
    expect(source).toMatch(/sourceId && !existing/);
    expect(source).toMatch(/Read\.ai source not found\./);
  });
});
