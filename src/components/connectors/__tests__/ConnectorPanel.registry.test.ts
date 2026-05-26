import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/connectors/ConnectorPanel.tsx"),
  "utf8",
);
const overviewSource = readFileSync(
  join(process.cwd(), "src/components/import/ImportOverviewDashboard.tsx"),
  "utf8",
);

describe("ConnectorPanel registry card boundary", () => {
  it("keeps ConnectorPanel card-only so lifecycle actions stay in ConnectorSetupCluster", () => {
    expect(source).not.toMatch(/ConnectorPanelLayout/);
    expect(source).not.toMatch(/handleConnectOAuth/);
    expect(source).not.toMatch(/handleDisconnect/);
    expect(source).not.toMatch(/ActionGroup/);
    expect(source).not.toMatch(/window\.open/);
    expect(source).not.toMatch(/adapter\.disconnect/);
  });

  it("keeps the import overview dashboard registry-driven", () => {
    expect(overviewSource).toMatch(/listConnectorAdapters\(\)/);
    expect(overviewSource).toMatch(/<ConnectorPanel/);
    expect(overviewSource).not.toMatch(/layout="card"/);
  });
});
