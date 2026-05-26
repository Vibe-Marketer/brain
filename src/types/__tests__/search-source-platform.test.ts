import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/types/search.ts"), "utf8");

describe("search SourcePlatform type", () => {
  it("derives source filters from SourceId instead of a hardcoded connector subset", () => {
    expect(source).toMatch(/import type \{ SourceAlias, SourceId \}/);
    expect(source).toMatch(/export type SourcePlatform = SourceId \| SourceAlias/);
    expect(source).not.toMatch(/'fathom-paste'/);
    expect(source).not.toMatch(/'fathom' \| 'zoom' \| 'youtube' \| 'file-upload'/);
  });
});
