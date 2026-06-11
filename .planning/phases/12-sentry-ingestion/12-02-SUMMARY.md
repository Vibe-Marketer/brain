---
phase: 12-sentry-ingestion
plan: 02
subsystem: edge-function
tags: [supabase, edge-function, sentry, webhook, hmac, zod, dedup, tdd]
requires:
  - "public.ingest_sentry_ticket RPC (12-01)"
  - "tickets.fingerprint partial unique index + occurrence_count/last_seen_at (12-01)"
provides:
  - "supabase/functions/sentry-webhook — signed event_alert receiver mapping to ingest_sentry_ticket"
  - "lib.ts pure-logic module: mapSeverity, deriveFingerprint, verifySentrySignature, issueAlertSchema"
  - "config.toml [functions.sentry-webhook] verify_jwt = false gateway exemption"
  - "Deno unit suite pinning signature gate, severity table, fingerprint derivation"
affects: [12-03, sentry-ingestion]
tech-stack:
  added: []
  patterns:
    - "Raw-body-first HMAC signature gate: 401 before any DB work (T-12-01)"
    - "Sentry bare-hex header reconciled to GitHub-style sha256= prefix via _shared/webhook-signing"
    - "Interface-first TDD: tests import from ../lib.ts before lib.ts exists (RED), then implement (GREEN)"
key-files:
  created:
    - supabase/functions/sentry-webhook/index.ts
    - supabase/functions/sentry-webhook/lib.ts
    - supabase/functions/sentry-webhook/__tests__/sentry-webhook.test.ts
    - supabase/functions/sentry-webhook/__tests__/fixtures/issue-alert-payload.json
  modified:
    - supabase/config.toml
decisions:
  - "lib.ts split out so the four pure functions are deno-testable without spinning a request — matches webhook-signing.ts extraction precedent"
  - "qp: fallback implemented exactly per plan (SENTRY_WEBHOOK_SECRET prefixed qp: → query-param auth) but primary path is HMAC; live secret has no prefix so HMAC is active"
  - "never-'critical' assertion widened to string at runtime — the strong return type makes === 'critical' a TS no-overlap error, which itself proves the contract statically"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-11"
---

# Phase 12 Plan 02: sentry-webhook Edge Function Summary

Signed Sentry `event_alert` webhook receiver shipped: HMAC-over-raw-body gate (401 before any DB work), zod-validated payload, locked level→severity map (fatal/error→high, warning→medium, else low — never critical), issue_id-based dedup fingerprint, and a single atomic `ingest_sentry_ticket` RPC round-trip. Gateway JWT exemption added; 12 Deno unit tests green.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Payload fixture + failing Deno unit tests | bf85050 | __tests__/sentry-webhook.deno.test.ts (orig .test.ts), __tests__/fixtures/issue-alert-payload.json |
| 2 (GREEN) | Implement sentry-webhook fn + config.toml exemption | 226b153 | sentry-webhook/index.ts, sentry-webhook/lib.ts, config.toml, (test type-fix) |
| 2b (fix) | Isolate Deno test from Vitest collection | 0be3eb0 | __tests__/sentry-webhook.deno.test.ts (rename), vitest.config.ts |

## Verification Evidence

**RED captured (Task 1):** `deno test` failed with `TS2307: Cannot find module .../lib.ts` before implementation — committed as bf85050.

**GREEN (Task 2):** `deno test --allow-read supabase/functions/sentry-webhook/__tests__/` → **12 passed | 0 failed**:
- mapSeverity table (fatal/error→high, warning→medium, info/debug/unknown/null→low) + never-critical sweep over 11 inputs
- deriveFingerprint = `sentry:1117540176` from fixture (ignores `fingerprint: ["{{ default }}"]`); null when issue_id absent; numeric coercion
- verifySentrySignature: true for valid bare-hex HMAC, false for tampered body / wrong secret / empty header
- issueAlertSchema accepts fixture, rejects missing data.event and missing issue_id

**Type-check:** `deno check supabase/functions/sentry-webhook/index.ts` → clean.

**Acceptance greps:**
- `[functions.sentry-webhook]` + `verify_jwt = false` present in config.toml (BLOCK_PRESENT)
- `index.ts` has NO import of `_shared/auth.ts` and NO `authenticateRequest` call (only the explanatory "do NOT import" comment matched)
- `timingSafeEqualString` + `computeHmacSha256Signature` both imported via lib.ts; `timingSafeEqualString` also imported directly in index.ts for the qp: fallback
- `rpc("ingest_sentry_ticket", ...)` present; 401 path runs zero supabase client calls before auth passes (client constructed only after the gate)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] never-'critical' test assertion tripped TS no-overlap error**
- **Found during:** Task 2 (GREEN type-check)
- **Issue:** `mapSeverity`'s return type is the literal union `"high"|"medium"|"low"`, so `result === "critical"` is a TS2367 no-overlap compile error — `deno test` type-checks before running.
- **Fix:** Widened the loop variable to `const result: string` and added a positive `["high","medium","low"].includes(result)` assertion. The strong return type still statically guarantees "critical" is unreachable; the runtime check pins it for future signature drift.
- **Files modified:** __tests__/sentry-webhook.deno.test.ts
- **Commit:** 226b153

**2. [Rule 1 - Bug] Deno unit test crashed the Vitest unit gate**
- **Found during:** 12-03 pre-flight (verifying `npm test` impact)
- **Issue:** The Deno test file matched Vitest's `supabase/functions/**/__tests__/*.test.ts` include glob, but its `https://deno.land` / `esm.sh` imports + `Deno.test` are unresolvable by Vitest's Node ESM loader — `npm test` failed to collect it (`Only URLs with a scheme in: file and data are supported`).
- **Fix:** Renamed to `sentry-webhook.deno.test.ts` and added `**/*.deno.test.ts` to `vitest.config.ts` exclude. `deno test` still collects it (12/12 pass); Vitest now skips it cleanly. Matches the repo precedent that function `__tests__/*.test.ts` files are Vitest-style static-analysis tests, not Deno-runtime tests.
- **Files modified:** __tests__/sentry-webhook.deno.test.ts (rename), vitest.config.ts
- **Commit:** 0be3eb0

## Known Stubs

None — `index.ts` is fully wired to the live `ingest_sentry_ticket` RPC; `lib.ts` functions are all exercised by the handler. Deploy + live-delivery proof are 12-03 scope.

## Threat Flags

None new. All surfaces map to the plan's threat register: T-12-01 (HMAC gate, 401 before DB), T-12-02 (512KB cap + method gate + single RPC), T-12-06 (generic 401 body, secret never logged), T-12-08 (parameterized RPC args + zod length caps). The qp: fallback is the plan's documented signature-unavailable path, gated behind a `qp:` secret prefix that the live secret does not have.

## Self-Check: PASSED

- index.ts, lib.ts, test, fixture, config.toml all exist on disk
- Commits bf85050 (RED) and 226b153 (GREEN) in git log
- No file deletions in either commit
