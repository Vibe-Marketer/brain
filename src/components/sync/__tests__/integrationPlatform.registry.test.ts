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

  it("resolves platform display metadata from connector adapters", () => {
    for (const platform of INTEGRATION_PLATFORMS) {
      const metadata = getIntegrationPlatformConfig(platform);
      expect(metadata).toBe(getConnectorAdapter(platform).metadata);
      expect(metadata.label).toBeTruthy();
      expect(metadata.icon).toBeTypeOf("function");
    }
  });

  it("keeps sync UI names, icons, and OAuth starts registry-driven", () => {
    const files = [
      "src/components/sync/AddIntegrationButton.tsx",
      "src/components/sync/IntegrationSourceCard.tsx",
      "src/components/sync/IntegrationStatusRow.tsx",
      "src/components/sync/InlineConnectionWizard.tsx",
      "src/components/integrations/CompactIntegrationButton.tsx",
      "src/components/integrations/ConnectedContent.tsx",
      "src/components/integrations/IntegrationConnectModal.tsx",
    ];
    const combinedSource = files
      .map((file) => readFileSync(join(repoRoot, file), "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/FathomIcon|ZoomIcon/);
    expect(combinedSource).not.toMatch(/platformNames\s*=/);
    expect(combinedSource).not.toMatch(/getFathomOAuthUrl|getZoomOAuthUrl/);
    expect(combinedSource).not.toMatch(/pendingOAuthPlatform/);
    expect(combinedSource).not.toMatch(/available: platform === "fathom"/);
    expect(combinedSource).not.toMatch(/comingSoon/);
    expect(combinedSource).not.toMatch(/Disconnect not implemented/);
    expect(combinedSource).toMatch(/getIntegrationPlatformConfig/);
    expect(combinedSource).toMatch(/getConnectorAdapter\(platform\)/);
    expect(combinedSource).toMatch(/ConnectorSetupCluster/);
  });
});
