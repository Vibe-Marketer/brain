import { describe, expect, it } from "vitest";
import { internalSecretDenied } from "../internal-secret-gate";

describe("internalSecretDenied", () => {
  it("denies when the configured secret is missing", () => {
    expect(internalSecretDenied(undefined, "abc")).toBe(true);
    expect(internalSecretDenied("", "abc")).toBe(true);
  });

  it("denies when the incoming header is missing or wrong", () => {
    expect(internalSecretDenied("secret", null)).toBe(true);
    expect(internalSecretDenied("secret", "")).toBe(true);
    expect(internalSecretDenied("secret", "other")).toBe(true);
  });

  it("allows only an exact match", () => {
    expect(internalSecretDenied("secret", "secret")).toBe(false);
  });
});
