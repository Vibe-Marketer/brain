/**
 * Deno unit tests for the sentry-webhook pure logic (lib.ts).
 *
 * Pins the contracts that Task 2 implements:
 *   - mapSeverity(level: unknown): "high" | "medium" | "low"   (never "critical")
 *   - deriveFingerprint(payload): string | null                (sentry:<issue_id>)
 *   - verifySentrySignature(rawBody, headerValue, secret): Promise<boolean>
 *   - issueAlertSchema (zod): accepts the fixture, rejects bodies missing
 *     data.event / data.event.issue_id
 *
 * Run: deno test supabase/functions/sentry-webhook/__tests__/
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deriveFingerprint,
  issueAlertSchema,
  mapSeverity,
  verifySentrySignature,
} from "../lib.ts";

const FIXTURE = JSON.parse(
  await Deno.readTextFile(
    new URL("./fixtures/issue-alert-payload.json", import.meta.url),
  ),
);

/**
 * Compute a Sentry-style BARE-hex HMAC-SHA256 over the raw body, the exact
 * convention the Sentry Integration Platform uses for `sentry-hook-signature`.
 * Computed here (not pinned to a fixture string) so there is no staleness.
 */
async function bareHexHmac(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Test 1: severity mapping (locked table — never "critical")
// ---------------------------------------------------------------------------
Deno.test("mapSeverity: fatal/error -> high, warning -> medium, else low", () => {
  assertEquals(mapSeverity("fatal"), "high");
  assertEquals(mapSeverity("error"), "high");
  assertEquals(mapSeverity("warning"), "medium");
  assertEquals(mapSeverity("info"), "low");
  assertEquals(mapSeverity("debug"), "low");
  assertEquals(mapSeverity(undefined), "low");
  assertEquals(mapSeverity(null), "low");
  assertEquals(mapSeverity("ANYTHING_ELSE"), "low");
  // Case-insensitivity (Sentry may send capitalized levels)
  assertEquals(mapSeverity("Error"), "high");
  assertEquals(mapSeverity("WARNING"), "medium");
});

Deno.test("mapSeverity: never produces 'critical' for any input", () => {
  for (
    const level of [
      "fatal",
      "error",
      "warning",
      "info",
      "debug",
      "critical",
      "",
      undefined,
      null,
      42,
      {},
    ]
  ) {
    // Widen to string so the never-"critical" check is a runtime assertion,
    // not a TS no-overlap compile error (the strong return type already
    // statically guarantees "critical" is unreachable — this pins it at runtime).
    const result: string = mapSeverity(level as unknown);
    assertEquals(result === "critical", false, `level=${String(level)}`);
    assertEquals(
      ["high", "medium", "low"].includes(result),
      true,
      `level=${String(level)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 2: fingerprint derivation from issue_id (NOT payload fingerprint field)
// ---------------------------------------------------------------------------
Deno.test("deriveFingerprint: uses data.event.issue_id, ignores fingerprint field", () => {
  assertEquals(deriveFingerprint(FIXTURE), "sentry:1117540176");
  // The fixture's fingerprint field is the trap — must be ignored.
  assertEquals(FIXTURE.data.event.fingerprint[0], "{{ default }}");
});

Deno.test("deriveFingerprint: returns null when issue_id absent", () => {
  assertEquals(deriveFingerprint({ data: { event: {} } }), null);
  assertEquals(deriveFingerprint({ data: {} }), null);
  assertEquals(deriveFingerprint({}), null);
  assertEquals(deriveFingerprint(null), null);
});

Deno.test("deriveFingerprint: coerces a numeric issue_id to string form", () => {
  assertEquals(
    deriveFingerprint({ data: { event: { issue_id: 1117540176 } } }),
    "sentry:1117540176",
  );
});

// ---------------------------------------------------------------------------
// Test 3: signature verification over the RAW body (bare-hex header)
// ---------------------------------------------------------------------------
Deno.test("verifySentrySignature: true for a valid bare-hex HMAC header", async () => {
  const secret = "test-client-secret-abc123";
  const rawBody = JSON.stringify(FIXTURE);
  const header = await bareHexHmac(rawBody, secret);
  assertEquals(await verifySentrySignature(rawBody, header, secret), true);
});

Deno.test("verifySentrySignature: false for tampered body", async () => {
  const secret = "test-client-secret-abc123";
  const rawBody = JSON.stringify(FIXTURE);
  const header = await bareHexHmac(rawBody, secret);
  const tampered = rawBody.replace("heck", "h4ck");
  assertEquals(await verifySentrySignature(tampered, header, secret), false);
});

Deno.test("verifySentrySignature: false for wrong secret", async () => {
  const rawBody = JSON.stringify(FIXTURE);
  const header = await bareHexHmac(rawBody, "the-right-secret");
  assertEquals(
    await verifySentrySignature(rawBody, header, "the-wrong-secret"),
    false,
  );
});

Deno.test("verifySentrySignature: false for empty header", async () => {
  const secret = "test-client-secret-abc123";
  const rawBody = JSON.stringify(FIXTURE);
  assertEquals(await verifySentrySignature(rawBody, "", secret), false);
});

// ---------------------------------------------------------------------------
// Test 4: zod schema accepts the fixture, rejects malformed payloads
// ---------------------------------------------------------------------------
Deno.test("issueAlertSchema: accepts the docs-verified fixture", () => {
  const parsed = issueAlertSchema.safeParse(FIXTURE);
  assertEquals(parsed.success, true);
  if (parsed.success) {
    assertExists(parsed.data.data.event.issue_id);
  }
});

Deno.test("issueAlertSchema: rejects body missing data.event", () => {
  assertEquals(
    issueAlertSchema.safeParse({ action: "triggered", data: {} }).success,
    false,
  );
});

Deno.test("issueAlertSchema: rejects body missing data.event.issue_id", () => {
  assertEquals(
    issueAlertSchema.safeParse({
      action: "triggered",
      data: { event: { title: "x", level: "error" } },
    }).success,
    false,
  );
});
