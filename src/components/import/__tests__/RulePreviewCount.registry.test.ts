import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/import/RulePreviewCount.tsx"),
  "utf8",
);

describe("RulePreviewCount source labels", () => {
  it("uses the shared source label helper", () => {
    expect(source).toMatch(/getSourceLabel\(call\.source_app\)/);
    expect(source).not.toMatch(/SOURCE_LABELS/);
  });
});
