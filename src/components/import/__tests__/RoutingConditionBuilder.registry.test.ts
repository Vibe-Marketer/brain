import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/import/RoutingConditionBuilder.tsx"),
  "utf8",
);

describe("RoutingConditionBuilder source registry wiring", () => {
  it("derives routing source options from the canonical source registry", () => {
    expect(source).toMatch(/SOURCE_REGISTRY\.map/);
    expect(source).not.toMatch(/\{ value: 'fathom', label: 'Fathom' \}/);
  });
});
