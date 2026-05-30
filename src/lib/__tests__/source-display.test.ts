import { describe, expect, it } from "vitest";
import { SOURCE_ALIASES, SOURCE_REGISTRY } from "@/config/source-registry";
import {
  getSourceDisplayOrder,
  getSourceIndicatorClass,
  isSourceVisibleInUi,
  sortSourcePlatforms,
} from "@/lib/source-display";

describe("source display helpers", () => {
  it("derives source order from the source registry", () => {
    for (const [index, source] of SOURCE_REGISTRY.entries()) {
      expect(getSourceDisplayOrder(source.id)).toBe(index);
    }
  });

  it("sorts source platforms by registry order and preserves legacy aliases", () => {
    expect(sortSourcePlatforms(["grain", "zoom", "fathom-paste"])).toEqual([
      "fathom-paste",
      "zoom",
      "grain",
    ]);
  });

  it("derives display aliases from the source registry", () => {
    for (const [alias, canonicalSource] of Object.entries(SOURCE_ALIASES)) {
      expect(getSourceDisplayOrder(alias)).toBe(
        getSourceDisplayOrder(canonicalSource),
      );
      expect(getSourceIndicatorClass(alias)).toBe(
        getSourceIndicatorClass(canonicalSource),
      );
    }
  });

  it("derives indicator classes from registry metadata", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(getSourceIndicatorClass(source.id)).toBe(source.indicatorClass);
    }
    expect(getSourceIndicatorClass("fathom-paste")).toBe(
      getSourceIndicatorClass("fathom"),
    );
    expect(getSourceIndicatorClass("unknown")).toBe("bg-muted-foreground");
  });

  it("keeps manual MCP import hidden while preserving registry display metadata", () => {
    expect(isSourceVisibleInUi("manual-mcp-import")).toBe(false);
    expect(getSourceIndicatorClass("manual-mcp-import")).toBe("bg-neutral-900");
    expect(getSourceDisplayOrder("manual-mcp-import")).toBeGreaterThan(
      getSourceDisplayOrder("paste-transcript"),
    );
  });
});
