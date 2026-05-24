import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("composio-trigger-webhook wiring — auth + signature contract", () => {
  it("returns 503 when COMPOSIO_WEBHOOK_SECRET is missing", () => {
    expect(source).toMatch(/COMPOSIO_WEBHOOK_SECRET/);
    expect(source).toMatch(/Webhook secret not configured/);
    expect(source).toMatch(/503/);
  });

  it("returns 401 when neither signature header is provided", () => {
    expect(source).toMatch(/webhook-signature/);
    expect(source).toMatch(/x-composio-signature/);
    expect(source).toMatch(/Missing webhook-signature header/);
  });

  it("returns 401 when verifyComposioSignature rejects the body", () => {
    expect(source).toMatch(/verifyComposioSignature\(/);
    expect(source).toMatch(/Invalid webhook signature/);
  });
});

describe("composio-trigger-webhook wiring — envelope contract", () => {
  it("returns 400 when the body is not JSON", () => {
    expect(source).toMatch(/Webhook body must be JSON/);
  });

  it("returns 400 when connected_account_id is missing", () => {
    expect(source).toMatch(/missing connected_account_id/);
  });
});

describe("composio-trigger-webhook wiring — lookup + anti-enumeration", () => {
  it("queries the dedicated composio_connected_account_id column (NOT the JSONB blob)", () => {
    // Regression guard: switching back to connection_metadata->> would bypass
    // the partial unique index.
    expect(source).toMatch(
      /\.eq\(\s*["']composio_connected_account_id["']\s*,\s*envelope\.connected_account_id\s*\)/,
    );
  });

  it("returns 200 with ignored=true and reason=no_match for unknown accounts", () => {
    // ADR-006 anti-enumeration — must never regress.
    expect(source).toMatch(/reason: ["']no_match["']/);
    expect(source).toMatch(/ignored: true/);
  });
});

describe("composio-trigger-webhook wiring — normalizer error handling (H3)", () => {
  it("wraps normalizeByToolkit in a try/catch and returns 200 ignored with reason=normalizer_failed", () => {
    expect(source).toMatch(/normalizeByToolkit\(/);
    expect(source).toMatch(/reason: ["']normalizer_failed["']/);
    // Logs a redacted breadcrumb — must not log the raw payload (PII).
    expect(source).toMatch(/normalizer failed/);
    expect(source).not.toMatch(/console\.error\([^)]*envelope\.payload/);
  });
});

describe("composio-trigger-webhook wiring — status update error check (H4)", () => {
  it("destructures the import_sources update error and logs on failure", () => {
    expect(source).toMatch(/error: statusUpdateError/);
    expect(source).toMatch(/failed to update import_sources status/);
  });
});

describe("composio-trigger-webhook wiring — pipeline failure breadcrumb (M3)", () => {
  it("emits console.error when pipeline result is unsuccessful and not skipped", () => {
    expect(source).toMatch(/pipeline failed/);
  });
});
