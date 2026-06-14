/**
 * Deno unit tests for the sentry-resolve pure logic (lib.ts).
 *
 * Run: deno test supabase/functions/sentry-resolve/__tests__/
 */
import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildResolveUrl,
  RESOLVE_BODY,
  resolveInputSchema,
  stripFingerprintPrefix,
} from "../lib.ts";

Deno.test("resolveInputSchema: accepts numeric issue_id with optional sentry prefix", () => {
  assertEquals(resolveInputSchema.parse({ issue_id: "12345" }), {
    issue_id: "12345",
  });
  assertEquals(resolveInputSchema.parse({ issue_id: "sentry:12345" }), {
    issue_id: "sentry:12345",
  });
});

Deno.test("resolveInputSchema: rejects empty, non-numeric, and oversized issue_id", () => {
  assertThrows(() => resolveInputSchema.parse({ issue_id: "" }));
  assertThrows(() => resolveInputSchema.parse({ issue_id: "sentry:" }));
  assertThrows(() => resolveInputSchema.parse({ issue_id: "abc123" }));
  assertThrows(() => resolveInputSchema.parse({ issue_id: "123/../../users" }));
  assertThrows(() =>
    resolveInputSchema.parse({ issue_id: "1".repeat(257) })
  );
});

Deno.test("stripFingerprintPrefix: removes only the sentry fingerprint prefix", () => {
  assertEquals(stripFingerprintPrefix("sentry:12345"), "12345");
  assertEquals(stripFingerprintPrefix("12345"), "12345");
});

Deno.test("buildResolveUrl: strips sentry prefix and builds the organization issue endpoint", () => {
  assertEquals(
    buildResolveUrl("ai-simple", "sentry:12345"),
    "https://sentry.io/api/0/organizations/ai-simple/issues/12345/",
  );
});

Deno.test("RESOLVE_BODY: pins Sentry resolved payload", () => {
  assertEquals(RESOLVE_BODY, { status: "resolved" });
});
