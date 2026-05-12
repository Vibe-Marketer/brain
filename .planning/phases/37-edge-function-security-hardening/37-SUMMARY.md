# Phase 37 Summary — Edge Function Security Hardening

**Status:** COMPLETE
**Date:** 2026-05-12
**Plans:** 37-01..05

## What Shipped

1. **Fresh comprehensive audit** of all 38 edge functions against a 12-item security checklist. Output: `.planning/security/2026-05-Q2-edge-audit.md`. **Result: 7/7 deferred-Phase-28 High findings verified PASS in live source. 0 new Critical, 0 new High.**

2. **polar-webhook hardened** (Plan 37-02 / SEC-01A..D):
   - DRY refactor via `upsertSubscription()` helper.
   - MCP provisioning wrapped in `EdgeRuntime.waitUntil`.
   - CORS apparatus stripped entirely.
   - Generic error responses to caller; full detail to `console.error` only.

3. **Shared-auth migration** (Plan 37-03 / SEC-02A): 26 functions migrated from manual `authHeader.replace('Bearer ', '')` to `_shared/auth.ts authenticateRequest()`. Combined with the 4 SEC-01E baseline migrations = 30/38 functions now on the shared helper. Only `mcp-server` retains its custom MCP-OAuth flow (documented exemption).

4. **OAuth token encryption tail** (Plan 37-04 / SEC-09): shipped one-shot migration `20260512000001_encrypt_existing_oauth_tokens.sql` + audit view + runbook for the manual ops run.

5. **Orphan cleanup** (Plan 37-05 / SEC-05A..C): 39 confirmed-dead orphan functions auto-deleted from production. Deployed count dropped from 77 → 38. Now matches source count exactly.

## Requirements Closed

SEC-01A, SEC-01B, SEC-01C, SEC-01D, SEC-02A, SEC-02B, SEC-05A, SEC-05B, SEC-05C, SEC-06, SEC-07, SEC-08 (magic-byte sub-item), SEC-09, SEC-10, SEC-11, SEC-12.

## Requirements Deferred

- **SEC-08 streaming** → v2.3 BACKLOG. Magic-byte fix closes the security risk; remaining concern is memory pressure (perf).
- **SEC-04A (service-role rationale comments)** → Phase 38 per ROADMAP (not Phase 37 scope).

## Manual Ops Action Required

After this phase deploys: run `SELECT encrypt_existing_oauth_tokens('<OAUTH_ENCRYPTION_KEY>')` in production. Runbook: `.planning/security/2026-05-Q2-token-encryption-baseline.md`.

## Surface Area Of Change

- **Edge functions:** 27 modified (polar-webhook + 26 shared-auth migrations).
- **Migrations:** 1 new.
- **Security docs:** 3 new (audit, deployed-source delta, encryption baseline/runbook).
- **Production deployments deleted:** 39 orphan functions.

## What's Next

- Phase 38 (Frontend Security & RLS Audit) picks up SEC-03A/B/C/D + SEC-04A/B/C + QA-07 CSP fix.
- Manual operator run of the OAuth encryption migration.

## Outstanding Followups (Non-Blocking)

- Stale-reference cleanup (v2.3 housekeeping):
  - `supabase/config.toml:76` `[functions.manager-notes]` block — orphaned.
  - `src/lib/query-config.ts:117` `managerNotes` query-key — no caller.
  - `supabase/functions/_shared/deduplication.ts:11` `google-meet-sync-meetings` comment — stale.
- Test coverage backfill for `_shared/auth.ts`, `_shared/html-escape.ts`, `_shared/oauth-encrypt.ts`, magic-byte detector, polar idempotency, zoom replay window — tracked to v2.3 BACKLOG.
