import { describe, expect, it } from "vitest";
import { SOURCE_ALIASES, SOURCE_REGISTRY } from "@/config/source-registry";
import { getSourceLabel } from "../source-labels";

describe("source labels registry wiring", () => {

  it("derives legacy alias labels from source aliases", () => {
    for (const [alias, canonicalSource] of Object.entries(SOURCE_ALIASES)) {
      expect(getSourceLabel(alias)).toBe(getSourceLabel(canonicalSource));
    }
  });

  it("pins manual MCP import label from registry", () => {
    expect(getSourceLabel("manual-mcp-import")).toBe("Manual MCP Import");
  });
});
