import { describe, expect, it } from "vitest";
import { verifyComposioSignature } from "../composio-client";

// Reference HMAC reused across this suite:
//   node -e "console.log(require('crypto').createHmac('sha256','shh').update('{}').digest('hex'))"
const REFERENCE_HEX =
  "9b7038c05edccf643d722b52dbaf2cea2b159caf339a5e12c0356e0b8b7b0794";

describe("verifyComposioSignature — happy paths", () => {
  it("accepts a raw hex signature matching the body+secret", async () => {
    expect(await verifyComposioSignature("{}", REFERENCE_HEX, "shh")).toBe(
      true,
    );
  });

  it("accepts a `sha256=`-prefixed signature", async () => {
    expect(
      await verifyComposioSignature("{}", `sha256=${REFERENCE_HEX}`, "shh"),
    ).toBe(true);
  });

  it("trims trailing whitespace after the `sha256=` prefix is stripped", async () => {
    // The prefix strip runs before .trim(), so leading whitespace before
    // `sha256=` would not be stripped. Composio's header format has no
    // leading whitespace; this test pins the documented behavior.
    expect(
      await verifyComposioSignature("{}", `sha256=${REFERENCE_HEX}  `, "shh"),
    ).toBe(true);
  });
});

describe("verifyComposioSignature — rejection paths", () => {
  it('rejects a tampered body (signature for `{}` against body `{"x":1}`)', async () => {
    expect(await verifyComposioSignature('{"x":1}', REFERENCE_HEX, "shh")).toBe(
      false,
    );
  });

  it("rejects an empty signature header", async () => {
    expect(await verifyComposioSignature("{}", "", "shh")).toBe(false);
  });

  it("rejects an empty secret (misconfigured deploy)", async () => {
    expect(await verifyComposioSignature("{}", REFERENCE_HEX, "")).toBe(false);
  });

  it("rejects a signature of the right shape but wrong content (same length, different chars)", async () => {
    // Same length, differs in last char only.
    const sameLengthDifferent = REFERENCE_HEX.slice(0, -1) + "0";
    expect(
      await verifyComposioSignature("{}", sameLengthDifferent, "shh"),
    ).toBe(false);
  });

  it("rejects when secret mismatches the signing key", async () => {
    expect(
      await verifyComposioSignature("{}", REFERENCE_HEX, "different-secret"),
    ).toBe(false);
  });
});
