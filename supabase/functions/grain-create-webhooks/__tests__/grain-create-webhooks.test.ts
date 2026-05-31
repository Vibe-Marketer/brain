import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("grain-create-webhooks wiring", () => {
  it("registers documented recording hooks against a token-routed Grain webhook URL", () => {
    expect(source).toMatch(/'recording_added'/);
    expect(source).toMatch(/'recording_updated'/);
    expect(source).toMatch(/createHook\(accessToken/);
    expect(source).toMatch(/buildPublicWebhookUrl\('grain-webhook'/);
  });

  it("stores webhook routing state on the user-owned Grain import source", () => {
    expect(source).toMatch(/resolveGrainSource<GrainWebhookSource>/);
    expect(source).toMatch(/webhook_path_token/);
    expect(source).toMatch(/connection_metadata/);
    expect(source).toMatch(/grain_webhooks/);
    expect(source).toMatch(/\.eq\('user_id', userId\)/);
  });

  it("reuses existing enabled hooks before creating new ones", () => {
    expect(source).toMatch(/listAllHooks/);
    expect(source).toMatch(/hook\.enabled !== false/);
    expect(source).toMatch(/hook\.hook_url === hookUrl/);
  });
});
