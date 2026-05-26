import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("read-ai-webhook wiring", () => {
  it("routes incoming Read.ai webhooks through import_sources.webhook_path_token", () => {
    expect(source).toMatch(/extractPathToken/);
    expect(source).toMatch(/\.eq\('source_app', 'read-ai'\)/);
    expect(source).toMatch(/\.eq\('webhook_path_token', pathToken\)/);
    expect(source).toMatch(/\.eq\('is_active', true\)/);
  });

  it("verifies the documented X-Read-Signature HMAC before importing", () => {
    expect(source).toMatch(/X-Read-Signature/);
    expect(source).toMatch(/verifyReadAiSignature/);
    expect(source).toMatch(/base64ToBytes\(signingKey\.trim\(\)\)/);
    expect(source).toMatch(/HMAC/);
    expect(source).toMatch(/SHA-256/);
    expect(source).toMatch(/timingSafeEqual/);
  });

  it("imports webhook payloads through the canonical connector pipeline with idempotency", () => {
    expect(source).toMatch(/payload\.session_id/);
    expect(source).toMatch(/payload\.request_id/);
    expect(source).toMatch(/processed_webhooks/);
    expect(source).toMatch(/readAiWebhookPayloadToMeeting/);
    expect(source).toMatch(/readAiMeetingToCanonical/);
    expect(source).toMatch(/runCanonicalConnectorPipeline/);
    expect(source).toMatch(/importSource:\s*'read-ai-webhook'/);
  });
});
