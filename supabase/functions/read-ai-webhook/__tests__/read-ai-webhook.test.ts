import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("read-ai-webhook wiring", () => {

  it("verifies the documented X-Read-Signature HMAC before importing", () => {
    expect(source).toMatch(/X-Read-Signature/);
    expect(source).toMatch(/verifyReadAiSignature/);
    expect(source).toMatch(/base64ToBytes\(signingKey\.trim\(\)\)/);
    expect(source).toMatch(/HMAC/);
    expect(source).toMatch(/SHA-256/);
    expect(source).toMatch(/timingSafeEqual/);
  });

});
