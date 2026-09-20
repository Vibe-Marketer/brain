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

});
