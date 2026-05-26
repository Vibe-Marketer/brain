import { describe, expect, it } from "vitest";
import {
  getOnboardingConnector,
  isOnboardingConnector,
  ONBOARDING_CONNECTORS,
} from "@/lib/onboarding-connectors";

describe("onboarding connectors", () => {
  it("derives setup-ready connector choices from shared capability metadata", () => {
    expect(ONBOARDING_CONNECTORS.map((adapter) => adapter.metadata.sourceApp)).toEqual([
      "fathom",
      "zoom",
      "fireflies",
      "read-ai",
    ]);
  });

  it("excludes non-onboarding connector shapes", () => {
    expect(isOnboardingConnector("grain")).toBe(false);
    expect(isOnboardingConnector("plaud")).toBe(false);
    expect(isOnboardingConnector("youtube")).toBe(false);
    expect(isOnboardingConnector("file-upload")).toBe(false);
    expect(getOnboardingConnector("paste-transcript")).toBeNull();
  });
});
