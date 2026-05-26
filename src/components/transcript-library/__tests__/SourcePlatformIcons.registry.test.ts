import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_REGISTRY } from "@/config/source-registry";
import { getSourcePlatformIcon } from "../SourcePlatformIcons";

describe("SourcePlatformIcons registry wiring", () => {
  it("returns registry icons for every canonical source", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(getSourcePlatformIcon(source.id)).toBe(source.icon);
    }
  });

  it("maps legacy source aliases through canonical source display metadata", () => {
    expect(getSourcePlatformIcon("fathom-paste")).toBe(
      getSourcePlatformIcon("fathom"),
    );
  });

  it("uses shared source-display ordering instead of a local priority map", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/transcript-library/SourcePlatformIcons.tsx"),
      "utf8",
    );

    expect(source).toMatch(/sortSourcePlatforms/);
    expect(source).toMatch(/getCanonicalDisplaySource/);
    expect(source).not.toMatch(/const priority/);
    expect(source).not.toMatch(/switch \(sourceApp\)/);
  });
});
