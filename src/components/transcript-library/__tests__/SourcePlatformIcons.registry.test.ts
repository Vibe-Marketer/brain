import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_REGISTRY } from "@/config/source-registry";
import { getSourcePlatformIcon } from "../SourcePlatformIcons";

describe("SourcePlatformIcons registry wiring", () => {

  it("maps legacy source aliases through canonical source display metadata", () => {
    expect(getSourcePlatformIcon("fathom-paste")).toBe(
      getSourcePlatformIcon("fathom"),
    );
  });

});
