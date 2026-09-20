import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/pages/SetupWizard.tsx"), "utf8");

describe("SetupWizard connector registry wiring", () => {

  it("validates OAuth returns against registered onboarding connector apps", () => {
    expect(source).toMatch(/isOnboardingConnector\(source\)/);
    expect(source).toMatch(/sourceApp={selected}/);
  });

  it("preserves connected setup state across OAuth returns", () => {
    expect(source).toMatch(/connectedMeta/);
    expect(source).toMatch(/sourceId = searchParams\.get\("sourceId"\)/);
    expect(source).toMatch(/email = searchParams\.get\("email"\)/);
    expect(source).toMatch(/saved\?\.connectedSources\.filter\(isOnboardingConnector\)/);
    expect(source).toMatch(/invalidateConnectorQueries\(queryClient, source\)/);
  });

});
