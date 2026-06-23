import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Capability-gating coverage migrated from the deleted forked import wizard's
// capabilities test (Phase 26-04 TBL-03). The forked wizard is gone;
// <ImportSurface> is the single surface that must gate the connect / search /
// import / "imports automatically" affordances via the shared
// getConnectorCapabilities helper for all 7 providers.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const source = readFileSync(
  join(repoRoot, "src/components/import/ImportSurface.tsx"),
  "utf8",
);

describe("ImportSurface connector capabilities (migrated from ConnectorImportWizard)", () => {
  it("uses the shared connector capabilities helper, not local adapter boolean checks", () => {
    expect(source).toMatch(/getConnectorCapabilities\(adapter\)/);
    expect(source).toMatch(/capabilities\.canSearchAvailable/);
    expect(source).toMatch(/capabilities\.canImportSelected/);
    expect(source).not.toMatch(
      /const canSearch = Boolean\(adapter\.searchAvailable\)/,
    );
    expect(source).not.toMatch(
      /const canImportSelected = Boolean\(adapter\.importSelected\)/,
    );
  });

  it("gates the find-new section + import button on the capabilities", () => {
    // No searchAvailable (file-upload, youtube) → no find section; no
    // importSelected → no import button.
    expect(source).toMatch(/const canSearch = capabilities\.canSearchAvailable/);
    expect(source).toMatch(
      /const canImportSelected = capabilities\.canImportSelected/,
    );
    expect(source).toMatch(/canSearch \?/);
    expect(source).toMatch(/canImportSelected \?/);
  });

  it("shows the 'imports automatically' card for webhook/upload providers", () => {
    expect(source).toMatch(/imports automatically/);
  });

  it("uses the shared setup cluster for connect / reconnect states", () => {
    expect(source).toMatch(/ConnectorSetupCluster/);
  });
});
