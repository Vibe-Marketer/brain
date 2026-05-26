import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/connectors/ConnectorImportWizard.tsx"),
  "utf8",
);

describe("ConnectorImportWizard capabilities", () => {
  it("uses shared connector capabilities instead of local adapter boolean checks", () => {
    expect(source).toMatch(/getConnectorCapabilities\(adapter\)/);
    expect(source).toMatch(/capabilities\.canSearchAvailable/);
    expect(source).toMatch(/capabilities\.canImportSelected/);
    expect(source).toMatch(/capabilities\.importsAutomatically/);
    expect(source).not.toMatch(/const canSearch = Boolean\(adapter\.searchAvailable\)/);
    expect(source).not.toMatch(/const canImportSelected = Boolean\(adapter\.importSelected\)/);
  });

  it("uses the shared setup cluster for import connect and reconnect states", () => {
    expect(source).toMatch(/ConnectorSetupCluster/);
    expect(source).not.toMatch(/ConnectorPanel/);
    expect(source).not.toMatch(/DefaultDestinationBar/);
  });
});
