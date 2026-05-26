import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

describe("read-ai-webhook-settings wiring", () => {
  it("requires user auth and resolves the active Read.ai source before returning webhook settings", () => {
    expect(source).toMatch(/authenticateRequest/);
    expect(source).toMatch(/resolveReadAiSource/);
    expect(source).toMatch(/\.eq\('source_app', 'read-ai'\)/);
    expect(source).toMatch(/\.eq\('is_active', true\)/);
  });

  it("creates a token-routed Read.ai webhook URL and stores the provider signing key", () => {
    expect(source).toMatch(/read-ai-webhook/);
    expect(source).toMatch(/generateReadAiWebhookPathToken/);
    expect(source).toMatch(/webhook_path_token: pathToken/);
    expect(source).toMatch(/webhook_signing_secret: signingSecret/);
  });

  it("registers Read.ai webhook functions with gateway JWT disabled", () => {
    expect(config).toMatch(/\[functions\.read-ai-webhook-settings\]\s+verify_jwt = false/);
    expect(config).toMatch(/\[functions\.read-ai-webhook\]\s+(?:#[^\n]*\n)?verify_jwt = false/);
  });
});
