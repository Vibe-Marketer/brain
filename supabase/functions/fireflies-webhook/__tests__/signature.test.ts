import { describe, expect, it } from "vitest";
import {
  computeHmacSha256Signature,
  timingSafeEqualString,
} from "../../_shared/webhook-signing";

describe("webhook signing — computeHmacSha256Signature", () => {
  it("produces the canonical sha256= hex string for a known body/secret pair", async () => {
    // Reference value computed via:
    //   node -e "console.log(require('crypto').createHmac('sha256','shh').update('{}').digest('hex'))"
    const expectedHex =
      "9b7038c05edccf643d722b52dbaf2cea2b159caf339a5e12c0356e0b8b7b0794";
    const signature = await computeHmacSha256Signature("{}", "shh");
    expect(signature).toBe(`sha256=${expectedHex}`);
  });

  it("produces different signatures for different bodies", async () => {
    const a = await computeHmacSha256Signature(
      '{"meeting_id":"abc"}',
      "secret",
    );
    const b = await computeHmacSha256Signature(
      '{"meeting_id":"xyz"}',
      "secret",
    );
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different secrets on the same body", async () => {
    const body = '{"meeting_id":"abc"}';
    const a = await computeHmacSha256Signature(body, "secret-one");
    const b = await computeHmacSha256Signature(body, "secret-two");
    expect(a).not.toBe(b);
  });
});

describe("webhook signing — timingSafeEqualString", () => {
  it("returns true for identical strings", () => {
    const sig = "sha256=deadbeef";
    expect(timingSafeEqualString(sig, sig)).toBe(true);
  });

  it("returns false when bodies have been tampered with (same length, different content)", async () => {
    const expected = await computeHmacSha256Signature(
      '{"meeting_id":"abc"}',
      "shh",
    );
    const tampered = await computeHmacSha256Signature(
      '{"meeting_id":"def"}',
      "shh",
    );
    // Both are sha256=<64 hex>; identical length, mismatched content.
    expect(expected.length).toBe(tampered.length);
    expect(timingSafeEqualString(expected, tampered)).toBe(false);
  });

  it("returns false when lengths differ (defensive case for malformed input)", () => {
    expect(
      timingSafeEqualString("sha256=deadbeef", "sha256=deadbeefcafe"),
    ).toBe(false);
  });

  it("returns true for two equal empty strings (degenerate but legal input)", () => {
    expect(timingSafeEqualString("", "")).toBe(true);
  });
});
