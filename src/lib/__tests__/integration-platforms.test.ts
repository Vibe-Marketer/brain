import { describe, expect, it } from "vitest";
import { listConnectorAdapters } from "@/components/connectors/registry/connectorRegistry";
import { getConnectorCapabilities } from "@/lib/connector-capabilities";
import { getConnectorSyncFunctionName } from "@/lib/connector-sync-functions";
import {
  INTEGRATION_PLATFORMS,
  usesLegacySourceLessSync,
} from "@/lib/integration-platforms";

describe("integration platform compatibility rules", () => {
  it("derives OAuth sync platforms from connector capabilities", () => {
    const expected = listConnectorAdapters()
      .filter((adapter) => {
        const capabilities = getConnectorCapabilities(adapter);
        return (
          adapter.setup.kind === "oauth" &&
          capabilities.canSearchAvailable &&
          capabilities.canImportSelected &&
          Boolean(getConnectorSyncFunctionName(adapter.metadata.sourceApp))
        );
      })
      .map((adapter) => adapter.metadata.sourceApp);

    expect(INTEGRATION_PLATFORMS).toEqual(expected);
    expect(INTEGRATION_PLATFORMS).toEqual([
      "fathom",
      "zoom",
      "read-ai",
    ]);
    expect(INTEGRATION_PLATFORMS).not.toContain("grain");
    expect(INTEGRATION_PLATFORMS).not.toContain("plaud");
    expect(INTEGRATION_PLATFORMS).not.toContain("fireflies");
  });

  it("keeps source-less sync limited to legacy Fathom connections", () => {
    expect(
      usesLegacySourceLessSync({ platform: "fathom", sourceId: null }),
    ).toBe(true);
    expect(
      usesLegacySourceLessSync({ platform: "fathom", sourceId: "source-1" }),
    ).toBe(false);
    expect(
      usesLegacySourceLessSync({ platform: "zoom", sourceId: null }),
    ).toBe(false);
  });
});
