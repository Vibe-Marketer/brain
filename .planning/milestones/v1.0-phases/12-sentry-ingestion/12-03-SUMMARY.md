---
phase: 12-sentry-ingestion
plan: 03
subsystem: edge-function
tags: [supabase, edge-function, sentry, integration-test, deploy, runbook, dedup]
requires:
  - "public.ingest_sentry_ticket RPC (12-01)"
  - "supabase/functions/sentry-webhook (12-02)"
provides:
  - "Real-Supabase integration proof of SEN-01/SEN-02 dedup + notification semantics"
  - "Deployed sentry-webhook function (live, signature-gated) on project vltmrnjsubfzrgrtdqey"
  - "docs/operations/sentry-webhook-setup.md operator runbook (the one human prerequisite)"
affects: [sentry-ingestion]
tech-stack:
  added: []
  patterns:
    - "Cross-suite isolation: non-swept email domain + explicit deleteUser to dodge sibling cleanup_test_fixture_users(0) races"
    - "Deploy proof: unsigned POST must return the FUNCTION's 401 body, not the gateway's missing-JWT message"
key-files:
  created:
    - supabase/functions/sentry-webhook/__tests__/sentry-webhook.integration.test.ts
    - docs/operations/sentry-webhook-setup.md
    - .planning/phases/12-sentry-ingestion/deferred-items.md
  modified: []
decisions:
  - "Dropped cleanup_test_fixture_users(0) from this suite's afterAll — it deletes ALL recent @callvault.test users across every parallel integration suite, race-deleting siblings' fixtures; switched to explicit deleteUser on owned IDs + a non-swept @sentry-phase12.invalid email domain"
  - "Replaced head:true count queries with full row selects — the JSON ->> filter + head-count combo is flaky under the parallel runner"
  - "Live Sentry->ticket end-to-end DEFERRED-VERIFY: supabase secrets list exposes only a digest, not the real Client Secret, so a valid-signature live probe is impossible from the executor; HMAC logic proven byte-identical to openssl instead"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-11"
---

# Phase 12 Plan 03: Integration Proof + Deploy + Runbook Summary

SEN-01/SEN-02 proven behaviorally against the real Supabase test project (dedup, occurrence increment, last_seen_at advance, per-admin notify, RLS invisibility for non-admins); function deployed live behind its signature gate (unsigned POST → 401 from the function, not the gateway); operator runbook written for the one human prerequisite (Sentry-side integration + alert rule).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Real-Supabase integration test (dedup + notify + RLS) | 1f29f24 | __tests__/sentry-webhook.integration.test.ts, deferred-items.md |
| 2 | Deploy function + Sentry setup runbook | 574a52e | docs/operations/sentry-webhook-setup.md |

## Verification Evidence

**Integration test (Task 1)** — `.env.test` IS configured (test project `swjzxiddcrtaqixsfaac`), so the suite RAN (not skipped): **3/3 green**, isolated and within the full parallel run, idempotent across reruns:
- Case 1+2: first call created=true/count=1; ticket source=sentry, type=bug, status=new, reporter_id NULL; 'created' event actor_id NULL. Second call (different args) created=false/count=2, same ticket_id, exactly one row, last_seen_at strictly advanced, severity stayed 'medium' + context.marker stayed 'first' (dedup does not overwrite).
- Case 3: high-severity ingest → exactly one user_notifications row (type 'system') for the temp ADMIN; second ingest added zero.
- Case 4: NULL-reporter Sentry ticket visible to service-role, returns ZERO rows for a temp non-admin JWT (T-12-04 proven).

**Deploy + smoke (Task 2):**
- `supabase functions deploy sentry-webhook --use-api` → exit 0 (uploaded index.ts, lib.ts, _shared/webhook-signing.ts; `__tests__/` NOT bundled).
- `curl -X POST .../functions/v1/sentry-webhook -d '{}'` → **HTTP 401, body `{"error":"invalid signature"}`** — the function's own body, proving the `verify_jwt=false` gateway exemption is live (NOT the gateway's "Missing authorization header").
- `curl -X GET` → 405 (method gate live).
- HMAC signing verified byte-identical to `openssl dgst -sha256 -hmac` (`e42b6b5b...`) for a known secret; `verifySentrySignature` returns true — proves the only reason the live valid-signature probe 401'd is the unknown real secret.

**lint:docs:** clean (no new violations).

**Unit gate (`npm test`):** 1908 passed / 1 failed; the failure (`rpc-type-smoke` flagging `ensure_skip_tag` trigger fn) is pre-existing and does NOT involve `ingest_sentry_ticket` (logged in deferred-items.md). Deno isolation fix from 12-02 holds — `npm test` collected 221 files with no sentry-webhook ESM-loader crash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-suite race deleting the test's ADMIN fixture**
- **Found during:** Task 1 (full parallel `npm run test:integration`)
- **Issue:** A sibling suite (`tickets-audit.integration.test.ts`) calls `cleanup_test_fixture_users(0)` in its afterAll, which deletes EVERY `@callvault.test` auth user created in the last 0 minutes — including this suite's freshly-created ADMIN — mid-test, cascading away its `user_roles` row so the notification fan-out saw no admin (Case 3 flaked: expected 1, got 0). Green in isolation, red under parallel load.
- **Fix:** Removed the shared `cleanup_test_fixture_users(0)` sweep from this suite's afterAll (it was also contaminating siblings) and switched temp-user emails to a non-swept domain `@sentry-phase12.invalid` so sibling sweeps cannot match them; cleanup is now explicit per-owned-user `deleteUser`. Also replaced flaky `head:true` count queries with full row selects.
- **Files modified:** __tests__/sentry-webhook.integration.test.ts
- **Commit:** 1f29f24

## Live-Delivery Status

**[DEFERRED-VERIFY: next real Sentry alert]** — The genuine Sentry → ticket end-to-end is PENDING the human prerequisite in `docs/operations/sentry-webhook-setup.md` (create internal integration, provision the real Client Secret, wire the alert rule). The executor cannot perform a valid-signature live probe because `supabase secrets list` exposes only a SHA256 *digest* of `SENTRY_WEBHOOK_SECRET`, not its value — only Sentry holds the real Client Secret used to sign deliveries.

Per the prereq note: the Sentry internal integration "CallVault Tickets" + alert rule on `call-vault` already exist and `SENTRY_WEBHOOK_SECRET` is provisioned (digest present in `supabase secrets list`). The 4 known open `call-vault` issues will file tickets on their next new-issue / unresolve transition once the alert rule action is confirmed wired. No "Send Test" / redelivery was triggered from the executor (no UI/API access to the Sentry integration from this context).

**Deferred idea recorded:** `sentry-autofix.yml` integration intentionally out of scope (CONTEXT.md deferred list).

## Known Stubs

None — the integration test exercises the live RPC; the runbook is complete and actionable.

## Threat Flags

None new. T-12-09 (test-project-only guard) satisfied via integration-setup's no-fallback env reads + the suite's `describe.skipIf` and non-swept temp rows. T-12-10 (runbook never contains a real secret) satisfied — only `<client-secret>` placeholders. T-12-01 (deploy smoke proves 401-on-unsigned) satisfied.

## Self-Check: PASSED

- integration test, runbook, deferred-items all exist on disk
- Commits 1f29f24 and 574a52e in git log
- No file deletions in either commit
