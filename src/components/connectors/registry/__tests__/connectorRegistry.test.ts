import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import {
  getConnectorSetupConfig,
  listConnectorAdapters,
} from "../connectorRegistry";
import { SOURCE_REGISTRY, VISIBLE_SOURCE_REGISTRY } from "@/config/source-registry";

describe("connector setup metadata", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

  function collectAdapterFunctionNames(adapterFileName: string): string[] {
    const source = readFileSync(
      join(repoRoot, "src/components/connectors/registry/adapters", adapterFileName),
      "utf8",
    );
    const functionNames = new Set<string>();
    const patterns = [
      /supabase\.functions\.invoke\(\s*["']([^"']+)["']/g,
      /invokeConnectorFunction\(\s*["']([^"']+)["']/g,
      /create(?:OAuthUrlGetter|TokenCredentialSaver)\(\s*["']([^"']+)["']/g,
      /functionName:\s*["']([^"']+)["']/g,
    ];

    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        functionNames.add(match[1]);
      }
    }

    return [...functionNames].sort();
  }

  function collectAdapterImportSelectedFunctionNames(
    adapterFileName: string,
  ): string[] {
    const source = readFileSync(
      join(repoRoot, "src/components/connectors/registry/adapters", adapterFileName),
      "utf8",
    );
    const importSelectedIndex = source.indexOf("importSelected");
    if (importSelectedIndex === -1) return [];

    const importSelectedSource = source.slice(importSelectedIndex);
    const functionNames = new Set<string>();
    const patterns = [
      /supabase\.functions\.invoke\(\s*["']([^"']+)["']/g,
      /functionName:\s*["']([^"']+)["']/g,
    ];

    for (const pattern of patterns) {
      for (const match of importSelectedSource.matchAll(pattern)) {
        functionNames.add(match[1]);
      }
    }

    return [...functionNames].sort();
  }

  function collectAdapterDisconnectFunctionNames(adapterFileName: string): string[] {
    const source = readFileSync(
      join(repoRoot, "src/components/connectors/registry/adapters", adapterFileName),
      "utf8",
    );
    const disconnectMatch = source.match(/disconnect\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*},/);
    if (!disconnectMatch?.[1]) return [];

    const disconnectSource = disconnectMatch[1];
    const functionNames = new Set<string>();
    const patterns = [
      /supabase\.functions\.invoke\(\s*["']([^"']+)["']/g,
      /invokeConnectorFunction\(\s*["']([^"']+)["']/g,
    ];

    for (const pattern of patterns) {
      for (const match of disconnectSource.matchAll(pattern)) {
        functionNames.add(match[1]);
      }
    }

    return [...functionNames].sort();
  }

  function collectConnectorRuntimeFunctionNames(): string[] {
    const functionNames = new Set<string>();
    const files = [
      "supabase/functions/fathom-oauth-callback/index.ts",
      "supabase/functions/read-ai-oauth-callback/index.ts",
      "supabase/functions/grain-oauth-callback/index.ts",
      "supabase/functions/grain-connect-token/index.ts",
      "supabase/functions/plaud-oauth-callback/index.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      for (const match of source.matchAll(
        /supabase\.functions\.invoke\(\s*["']([^"']+)["']/g,
      )) {
        functionNames.add(match[1]);
      }
    }

    return [...functionNames].sort();
  }

  it("keeps native source registry entries backed by connector adapters", () => {
    const adaptersBySource = new Map(
      listConnectorAdapters().map((adapter) => [
        adapter.metadata.sourceApp,
        adapter,
      ]),
    );

    for (const source of VISIBLE_SOURCE_REGISTRY.filter((entry) => entry.adapter === "native")) {
      expect(adaptersBySource.has(source.id)).toBe(true);
    }

    expect(getConnectorSetupConfig("grain").kind).toBe("oauth");
    expect(adaptersBySource.has("grain")).toBe(false);
  });

  it("derives connector source types from the source registry", () => {
    const sourceRegistry = readFileSync(
      join(repoRoot, "src/config/source-registry.ts"),
      "utf8",
    );
    const connectorTypes = readFileSync(
      join(repoRoot, "src/components/connectors/registry/types.ts"),
      "utf8",
    );

    expect(sourceRegistry).toMatch(
      /export type SourceId = \(typeof SOURCE_REGISTRY\)\[number\]\["id"\]/,
    );
    expect(connectorTypes).toMatch(/import type \{ SourceId \}/);
    expect(connectorTypes).toMatch(
      /export type ConnectorSourceApp = Exclude<SourceId, "paste-transcript">/,
    );
    expect(connectorTypes).not.toMatch(
      /export type ConnectorSourceApp =\s*\|/,
    );
  });

  it("keeps connector adapter metadata aligned with the source registry", () => {
    const registryBySource = new Map(
      SOURCE_REGISTRY.map((source) => [source.id, source]),
    );

    for (const adapter of listConnectorAdapters()) {
      const source = registryBySource.get(adapter.metadata.sourceApp);
      expect(source).toBeDefined();
      expect(adapter.metadata.label).toBe(source?.label);
      expect(adapter.metadata.badge).toBe(
        source?.status === "beta" || source?.status === "scaffold"
          ? "beta"
          : undefined,
      );
    }
  });

  it("registers setup metadata for every connector", () => {
    expect(
      Object.fromEntries(
        listConnectorAdapters().map((adapter) => [
          adapter.metadata.sourceApp,
          adapter.setup.kind,
        ]),
      ),
    ).toEqual({
      fathom: "oauth",
      zoom: "oauth",
      fireflies: "api_key_webhook",
      "read-ai": "oauth",
      plaud: "browser_bridge",
      youtube: "none",
      "file-upload": "none",
    });
  });

  it("keeps Fireflies webhook setup details in adapter metadata", () => {
    const setup = getConnectorSetupConfig("fireflies");

    expect(setup.webhook).toMatchObject({
      required: true,
      providerLabel: "Fireflies",
      urlLabel: "Webhook URL for Fireflies",
      signingSecretLabel: "Webhook signing secret",
      signingSecretField: "webhookSecret",
      destinationPath: "fireflies-webhook",
      pathTokenField: "webhookPathToken",
    });
    expect(setup.webhook?.eventTypes).toEqual([
      "meeting.transcribed",
      "meeting.summarized",
    ]);
    expect(setup.credentialFields?.map((field) => field.name)).toEqual([
      "apiKey",
    ]);
  });

  it("keeps Fathom OAuth-first without a visible webhook setup panel", () => {
    const setup = getConnectorSetupConfig("fathom");

    expect(setup.kind).toBe("oauth");
    expect(setup.supportsMultipleAccounts).toBe(true);
    expect(setup.webhook).toBeUndefined();
    expect(setup.credentialFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "webhookSecret",
          secret: true,
        }),
      ]),
    );
  });

  it("marks Plaud beta setup as browser bridge metadata", () => {
    const setup = getConnectorSetupConfig("plaud");

    expect(setup).toMatchObject({
      kind: "browser_bridge",
      beta: true,
      accountLabelField: "email",
    });
    expect(setup.credentialFields?.map((field) => field.name)).toEqual([
      "apiKey",
      "apiBase",
    ]);
  });

  it("keeps adapter Edge Function references backed by deployable functions", () => {
    const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");
    const adapters = [
      "fathom.ts",
      "fireflies.ts",
      "grain.ts",
      "plaud.ts",
      "read-ai.ts",
      "zoom.ts",
    ];

    for (const adapterFileName of adapters) {
      for (const functionName of collectAdapterFunctionNames(adapterFileName)) {
        expect(
          existsSync(join(repoRoot, "supabase/functions", functionName, "index.ts")),
          `${adapterFileName} references missing Edge Function ${functionName}`,
        ).toBe(true);
        expect(
          config,
          `${adapterFileName} references ${functionName}, but supabase/config.toml has no function block`,
        ).toMatch(new RegExp(`\\[functions\\.${functionName.replaceAll("-", "\\-")}\\]`));
      }
    }
  });

  it("keeps source registry sync functions backed by deployable functions", () => {
    const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");

    for (const source of SOURCE_REGISTRY) {
      for (const [fieldName, functionName] of [
        ["oauthUrlFunctionName", source.oauthUrlFunctionName],
        ["oauthCallbackFunctionName", source.oauthCallbackFunctionName],
        ["searchFunctionName", source.searchFunctionName],
        ["credentialFunctionName", source.credentialFunctionName],
        ["webhookSettingsFunctionName", source.webhookSettingsFunctionName],
        ["syncFunctionName", source.syncFunctionName],
        ["disconnectFunctionName", source.disconnectFunctionName],
      ] as const) {
        if (!functionName) continue;

        expect(
          existsSync(
            join(repoRoot, "supabase/functions", functionName, "index.ts"),
          ),
          `${source.id} ${fieldName} references missing Edge Function ${functionName}`,
        ).toBe(true);
        expect(
          config,
          `${source.id} ${fieldName} references ${functionName}, but supabase/config.toml has no function block`,
        ).toMatch(
          new RegExp(`\\[functions\\.${functionName.replaceAll("-", "\\-")}\\]`),
        );
      }
    }
  });

  it("keeps webhook-capable sources backed by deployable webhook functions", () => {
    const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");

    for (const source of SOURCE_REGISTRY) {
      if (!source.hasWebhook) {
        expect(source.webhookFunctionName).toBeUndefined();
        expect(source.webhookRegistrationFunctionName).toBeUndefined();
        continue;
      }

      expect(source.webhookFunctionName, `${source.id} has no webhookFunctionName`).toBeDefined();

      const functionNames = [
        source.webhookFunctionName,
        source.webhookSettingsFunctionName,
        source.webhookRegistrationFunctionName,
      ].filter(Boolean);

      for (const functionName of functionNames) {
        expect(
          existsSync(join(repoRoot, "supabase/functions", functionName, "index.ts")),
          `${source.id} webhook metadata references missing Edge Function ${functionName}`,
        ).toBe(true);
        expect(
          config,
          `${source.id} webhook metadata references ${functionName}, but supabase/config.toml has no function block`,
        ).toMatch(new RegExp(`\\[functions\\.${functionName.replaceAll("-", "\\-")}\\]`));
      }
    }
  });

  it("keeps manual webhook setup destinations aligned with source registry metadata", () => {
    const registryBySource = new Map(
      SOURCE_REGISTRY.map((source) => [source.id, source]),
    );

    for (const adapter of listConnectorAdapters()) {
      const destinationPath = adapter.setup.webhook?.destinationPath;
      if (!destinationPath) continue;

      const source = registryBySource.get(adapter.metadata.sourceApp);
      expect(source?.webhookFunctionName).toBe(
        destinationPath,
      );
    }
  });

  it("keeps adapter selected-import functions aligned with source registry sync metadata", () => {
    const adaptersBySource = {
      fathom: "fathom.ts",
      zoom: "zoom.ts",
      fireflies: "fireflies.ts",
      "read-ai": "read-ai.ts",
      grain: "grain.ts",
      plaud: "plaud.ts",
    } as const;

    for (const [sourceId, adapterFileName] of Object.entries(adaptersBySource)) {
      const source = SOURCE_REGISTRY.find((entry) => entry.id === sourceId);

      expect(source?.syncFunctionName, `${sourceId} has no syncFunctionName`).toBeDefined();
      expect(
        collectAdapterImportSelectedFunctionNames(adapterFileName),
        `${adapterFileName} importSelected must invoke ${source?.syncFunctionName}`,
      ).toContain(source?.syncFunctionName);
    }
  });

  it("keeps adapter search and credential functions aligned with source registry metadata", () => {
    const adaptersBySource = {
      fathom: "fathom.ts",
      zoom: "zoom.ts",
      fireflies: "fireflies.ts",
      "read-ai": "read-ai.ts",
      grain: "grain.ts",
      plaud: "plaud.ts",
    } as const;

    for (const [sourceId, adapterFileName] of Object.entries(adaptersBySource)) {
      const source = SOURCE_REGISTRY.find((entry) => entry.id === sourceId);
      const adapterFunctions = collectAdapterFunctionNames(adapterFileName);

      if (source?.searchFunctionName) {
        expect(
          adapterFunctions,
          `${adapterFileName} search must invoke ${source.searchFunctionName}`,
        ).toContain(source.searchFunctionName);
      }

      if (source?.credentialFunctionName) {
        expect(
          adapterFunctions,
          `${adapterFileName} credential save must invoke ${source.credentialFunctionName}`,
        ).toContain(source.credentialFunctionName);
      }
    }
  });

  it("keeps adapter OAuth functions aligned with source registry OAuth metadata", () => {
    const adaptersBySource = {
      fathom: "fathom.ts",
      zoom: "zoom.ts",
      fireflies: "fireflies.ts",
      "read-ai": "read-ai.ts",
      grain: "grain.ts",
      plaud: "plaud.ts",
    } as const;

    for (const [sourceId, adapterFileName] of Object.entries(adaptersBySource)) {
      const source = SOURCE_REGISTRY.find((entry) => entry.id === sourceId);
      const adapterFunctions = collectAdapterFunctionNames(adapterFileName);

      if (source?.oauthUrlFunctionName) {
        expect(source?.oauthUrlFunctionName, `${sourceId} has no oauthUrlFunctionName`).toBeDefined();
        expect(source?.oauthCallbackFunctionName, `${sourceId} has no oauthCallbackFunctionName`).toBeDefined();
      }

      if (source?.authMode === "oauth2") {
        expect(
          adapterFunctions,
          `${adapterFileName} OAuth setup must invoke ${source?.oauthUrlFunctionName}`,
        ).toContain(source?.oauthUrlFunctionName);
      }
    }
  });

  it("keeps adapter disconnect cleanup aligned with source registry disconnect metadata", () => {
    const adaptersBySource = {
      fathom: "fathom.ts",
      zoom: "zoom.ts",
      fireflies: "fireflies.ts",
      "read-ai": "read-ai.ts",
      grain: "grain.ts",
      plaud: "plaud.ts",
    } as const;

    for (const [sourceId, adapterFileName] of Object.entries(adaptersBySource)) {
      const source = SOURCE_REGISTRY.find((entry) => entry.id === sourceId);
      const disconnectFunctions = collectAdapterDisconnectFunctionNames(adapterFileName);

      if (source?.disconnectFunctionName) {
        expect(
          disconnectFunctions,
          `${adapterFileName} disconnect must invoke ${source.disconnectFunctionName}`,
        ).toContain(source.disconnectFunctionName);
      } else {
        expect(
          disconnectFunctions,
          `${adapterFileName} has a disconnect Edge Function that is not declared in source registry`,
        ).toEqual([]);
      }
    }
  });

  it("keeps external setup connectors capable of connect and disconnect lifecycle actions", () => {
    for (const adapter of listConnectorAdapters()) {
      if (adapter.setup.kind === "none") continue;

      expect(adapter.disconnect, `${adapter.metadata.sourceApp} has no disconnect handler`).toBeTypeOf("function");

      if (adapter.metadata.authMethods.includes("oauth")) {
        expect(adapter.getOAuthAuthUrl, `${adapter.metadata.sourceApp} advertises OAuth without OAuth URL handler`).toBeTypeOf("function");
      }

      if (adapter.metadata.authMethods.includes("api_key")) {
        expect(adapter.saveApiKeyCredentials, `${adapter.metadata.sourceApp} advertises API key/token auth without credential saver`).toBeTypeOf("function");
        expect(adapter.setup.credentialFields?.length ?? 0, `${adapter.metadata.sourceApp} credential setup has no fields`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps connector runtime Edge Function invokes backed by deployable config", () => {
    const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");

    for (const functionName of collectConnectorRuntimeFunctionNames()) {
      expect(
        existsSync(join(repoRoot, "supabase/functions", functionName, "index.ts")),
        `connector runtime references missing Edge Function ${functionName}`,
      ).toBe(true);
      expect(
        config,
        `connector runtime references ${functionName}, but supabase/config.toml has no function block`,
      ).toMatch(new RegExp(`\\[functions\\.${functionName.replaceAll("-", "\\-")}\\]`));
    }
  });
});
