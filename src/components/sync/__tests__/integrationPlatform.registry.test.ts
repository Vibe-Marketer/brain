import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getIntegrationPlatformConfig,
  INTEGRATION_PLATFORMS,
} from "@/lib/integration-platforms";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";

describe("legacy sync integration registry bridge", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

  it("derives OAuth sync pane platforms from the connector registry", () => {
    expect(INTEGRATION_PLATFORMS).toEqual([
      "fathom",
      "zoom",
      "read-ai",
    ]);
    expect(INTEGRATION_PLATFORMS).not.toContain("grain");
    expect(INTEGRATION_PLATFORMS).not.toContain("plaud");
  });

});
