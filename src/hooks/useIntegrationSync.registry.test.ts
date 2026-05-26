import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("useIntegrationSync registry bridge", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const hookSource = readFileSync(
    join(repoRoot, "src/hooks/useIntegrationSync.ts"),
    "utf8",
  );
  const serviceSource = readFileSync(
    join(repoRoot, "src/services/integrations.service.ts"),
    "utf8",
  );
  const providerSource = readFileSync(
    join(repoRoot, "src/components/integrations/IntegrationsRealtimeProvider.tsx"),
    "utf8",
  );

  it("loads active import_sources rows for sync-capable integration platforms (service)", () => {
    expect(serviceSource).toMatch(/from\("import_sources"\)/);
    expect(serviceSource).toMatch(/\.in\("source_app", \[\.\.\.INTEGRATION_PLATFORMS\]\)/);
    expect(serviceSource).toMatch(/sourceId\?: string \| null/);
    expect(serviceSource).toMatch(/for \(const platform of INTEGRATION_PLATFORMS\)/);
  });

  it("subscribes to import_sources changes via the central realtime provider", () => {
    expect(providerSource).toMatch(/table: "import_sources"/);
    expect(providerSource).toMatch(/integration_sources_/);
  });

  it("does not depend on the removed inline OAuth sessionStorage flag", () => {
    expect(hookSource).not.toMatch(/pendingOAuthPlatform/);
    expect(hookSource).not.toMatch(/sessionStorage/);
    expect(serviceSource).not.toMatch(/pendingOAuthPlatform/);
    expect(serviceSource).not.toMatch(/sessionStorage/);
  });

  it("uses the shared connector sync contract for manual sync triggers", () => {
    expect(serviceSource).toMatch(/getConnectorSyncFunctionName\(platform\)/);
    expect(hookSource).toMatch(/getIntegrationPlatformConfig\(platform\)\.label/);
    expect(serviceSource).toMatch(/usesLegacySourceLessSync/);
    expect(hookSource).toMatch(/invalidateCallListCaches\(queryClient\)/);
    expect(hookSource).toMatch(/queryKeys\.imports\.counts\(\)/);
    expect(hookSource).toMatch(/queryKeys\.imports\.failed\(\)/);
    expect(serviceSource).not.toMatch(/zoom-sync-meetings/);
    expect(hookSource).not.toMatch(/zoom-sync-meetings/);
  });

  it("shares legacy connection interpretation with the canonical connector hook", () => {
    expect(serviceSource).toMatch(/isLegacyConnectorConnected\(/);
    expect(serviceSource).not.toMatch(/settings\?\.fathom_api_key \|\|/);
    expect(serviceSource).not.toMatch(/settings\?\.zoom_oauth_token_expires &&/);
  });

  it("eliminates the per-mount realtime subscription and forceUpdate anti-pattern", () => {
    // The pre-migration hook opened two realtime channels per consumer mount
    // (9 consumers × 2 = 18 channels open per page) and used a setState({})
    // forceUpdate to re-render off a ref. Both are gone — realtime is now
    // mounted exactly once at the AppShell level by IntegrationsRealtimeProvider.
    expect(hookSource).not.toMatch(/supabase\.channel/);
    expect(hookSource).not.toMatch(/forceUpdate/);
    expect(hookSource).not.toMatch(/syncingPlatformsRef/);
  });
});
