import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

describe("grain-disconnect wiring", () => {
  it("authenticates the user and resolves the active Grain source before cleanup", () => {
    expect(source).toMatch(/authenticateRequest/);
    expect(source).toMatch(/resolveGrainSource/);
    expect(source).toMatch(/id, webhook_path_token, connection_metadata/);
  });

  it("deletes stored and URL-matched Grain hooks before deactivating the source", () => {
    expect(source).toMatch(/getHookIdsFromMetadata/);
    expect(source).toMatch(/listMatchingHookIds/);
    expect(source).toMatch(/deleteHook\(accessToken, hookId\)/);
    expect(source).toMatch(/is_active: false/);
    expect(source).toMatch(/grain_webhooks: \[\]/);
  });

  it("keeps local disconnect moving even when remote webhook cleanup fails", () => {
    expect(source).toMatch(/Grain webhook cleanup skipped/);
    expect(source).toMatch(/error: message/);
    expect(source).toMatch(/disconnected: true/);
  });

  it("is configured as a user-initiated edge function", () => {
    expect(config).toMatch(/\[functions\.grain-disconnect\]\s+verify_jwt = false/);
  });
});
