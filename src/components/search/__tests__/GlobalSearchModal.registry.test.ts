import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/search/GlobalSearchModal.tsx"),
  "utf8",
);

describe("GlobalSearchModal source display", () => {
  it("uses registry-backed source indicator classes", () => {
    expect(source).toMatch(/getSourceIndicatorClass\(result\.sourcePlatform\)/);
    expect(source).not.toMatch(/const colors: Record<string, string>/);
  });
});
