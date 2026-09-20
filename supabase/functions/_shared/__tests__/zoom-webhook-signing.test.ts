import { describe, expect, it } from "vitest";
import {
  computeZoomWebhookSignature,
  generateZoomChallengeResponse,
  verifyZoomWebhookSignature,
} from "../webhook-signing";

describe("Zoom webhook HMAC (hex, v0= prefix)", () => {
  it("signs v0:{timestamp}:{body} as v0=<hex>, not sha256=", async () => {
    const sig = await computeZoomWebhookSignature("secret", "1700000000", "{}");
    expect(sig.startsWith("v0=")).toBe(true);
    expect(sig.startsWith("sha256=")).toBe(false);
    expect(sig.length).toBe(3 + 64);
  });

  it("accepts a matching signature and rejects a tampered body", async () => {
    const secret = "zoom-secret";
    const ts = "1700000000";
    const body = '{"event":"recording.completed"}';
    const good = await computeZoomWebhookSignature(secret, ts, body);
    expect(await verifyZoomWebhookSignature(secret, ts, body, good)).toBe(true);
    expect(
      await verifyZoomWebhookSignature(secret, ts, '{"event":"other"}', good),
    ).toBe(false);
  });

  it("challenge response is 64-char hex of HMAC(plainToken)", async () => {
    const hex = await generateZoomChallengeResponse("plain-token", "zoom-secret");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    const other = await generateZoomChallengeResponse("other-token", "zoom-secret");
    expect(hex).not.toBe(other);
  });
});
