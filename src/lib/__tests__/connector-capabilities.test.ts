import { describe, expect, it } from "vitest";
import { listConnectorAdapters } from "@/components/connectors/registry/connectorRegistry";
import { getConnectorCapabilities } from "@/lib/connector-capabilities";

describe("connector capabilities", () => {
  it("derives search and selected-import support from adapter functions", () => {
    for (const adapter of listConnectorAdapters()) {
      const capabilities = getConnectorCapabilities(adapter);

      expect(capabilities.canSearchAvailable).toBe(
        Boolean(adapter.searchAvailable),
      );
      expect(capabilities.canImportSelected).toBe(
        Boolean(adapter.importSelected),
      );
      expect(capabilities.importsAutomatically).toBe(
        !adapter.searchAvailable || !adapter.importSelected,
      );
    }
  });

  it("derives setup-wizard onboarding support from setup kind metadata", () => {
    const onboardingKinds = new Set(["oauth", "api_key", "api_key_webhook"]);

    for (const adapter of listConnectorAdapters()) {
      expect(
        getConnectorCapabilities(adapter).canOnboardInSetupWizard,
      ).toBe(onboardingKinds.has(adapter.setup.kind));
    }
  });
});
