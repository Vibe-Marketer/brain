import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/pages/SetupWizard.tsx"), "utf8");

describe("SetupWizard connector registry wiring", () => {
  it("derives onboarding connector choices from connector adapter setup metadata", () => {
    expect(source).toMatch(/ONBOARDING_CONNECTORS/);
    expect(source).toMatch(/@\/lib\/onboarding-connectors/);
    expect(source).not.toMatch(/adapter\.setup\.kind === "oauth"/);
    expect(source).not.toMatch(/adapter\.setup\.kind === "api_key"/);
    expect(source).not.toMatch(/adapter\.setup\.kind === "api_key_webhook"/);
    expect(source).toMatch(/ONBOARDING_CONNECTORS\.map/);
  });

  it("renders connector-specific onboarding links from source metadata", () => {
    expect(source).toMatch(/tryGetSourceConfig\(sourceApp\)/);
    expect(source).toMatch(/onboardingLink\.href/);
    expect(source).toMatch(/onboardingLink\.label/);
    expect(source).not.toMatch(/adapter\.metadata\.sourceApp === "fathom"/);
  });

  it("validates OAuth returns against registered onboarding connector apps", () => {
    expect(source).toMatch(/isOnboardingConnector\(source\)/);
    expect(source).toMatch(/sourceApp={selected}/);
  });
});
