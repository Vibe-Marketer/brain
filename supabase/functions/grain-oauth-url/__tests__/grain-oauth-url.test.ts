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

  it("factory validates caller-provided source ids before persisting OAuth state", () => {
    expect(factorySource).toMatch(/config\.resolveSource\(supabase,\s*userId,\s*requestedSourceId\)/);
    expect(factorySource.indexOf("config.resolveSource"))
      .toBeLessThan(factorySource.indexOf("pending_import_source_id"));
  });

});
