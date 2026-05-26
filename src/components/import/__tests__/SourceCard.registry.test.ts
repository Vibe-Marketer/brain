import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("SourceCard registry wiring", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const source = readFileSync(
    join(repoRoot, "src/components/import/SourceCard.tsx"),
    "utf8",
  );

  it("uses shared source auth classification instead of a hardcoded OAuth source list", () => {
    expect(source).toMatch(/isOAuthConnectorSource\(sourceApp\)/);
    expect(source).not.toMatch(/authMode === 'oauth2'/);
    expect(source).not.toMatch(/sourceApp === 'fathom' \|\| sourceApp === 'zoom'/);
  });
});
