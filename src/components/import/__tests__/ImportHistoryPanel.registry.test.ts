import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/import/ImportHistoryPanel.tsx"),
  "utf8",
);

describe("ImportHistoryPanel source registry wiring", () => {
  it("uses shared source icon/label helpers instead of a local source icon map", () => {
    expect(source).toMatch(/getSourcePlatformIcon\(source_app\)/);
    expect(source).toMatch(/getSourceLabel\(source_app\)/);
    expect(source).not.toMatch(/SOURCE_LABELS/);
    expect(source).not.toMatch(/const SOURCE_ICONS/);
  });
});
