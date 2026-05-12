---
phase: 37
phase_name: Edge Function Security Hardening
verified: 2026-05-12
status: PASS
---

# Phase 37 Verification

## Success Criteria (from ROADMAP.md)

### 1. Deferred Phase 28 High findings closed

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SEC-06 zoom-webhook timing-safe HMAC | PASS | `zoom-webhook/index.ts:50-58` |
| SEC-07 (Zoom) 5-min replay window | PASS | `zoom-webhook/index.ts:753-780` |
| SEC-07 (Polar) replay window | PASS | `polar-webhook/index.ts:81-84` (Svix SDK enforces) |
| SEC-08 magic-byte validation | PASS | `file-upload-transcribe/index.ts:18-61` |
| SEC-08 streaming uploads | DEFERRED → v2.3 | Memory-pressure perf concern, not security |
| SEC-09 fathom-oauth-callback token encryption | PASS | `fathom-oauth-callback/index.ts:104-167` + migration `20260509000001` + new `20260512000001` for existing rows |
| SEC-10 send-org-invite HTML escape | PASS | `send-org-invite/index.ts:76-79` via `_shared/html-escape.ts` |
| SEC-11 share-call recordings-row gate | PASS | `share-call/index.ts:146-157` |
| SEC-12 polar-webhook idempotency | PASS | `polar-webhook/index.ts:91-164` (processed_webhooks) |

### 2. polar-webhook hardened

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SEC-01A DRY refactor (upsertSubscription helper) | PASS | `grep -c "upsertSubscription" polar-webhook/index.ts` = 3 (def + 2 call sites) |
| SEC-01B Async MCP provisioning (EdgeRuntime.waitUntil) | PASS | `grep -c "EdgeRuntime.waitUntil" polar-webhook/index.ts` = 1 (centralized in `provisionMcpTokenAsync` helper used at 2 call sites) |
| SEC-01C Strip CORS | PASS | `grep -c "corsHeaders" polar-webhook/index.ts` = 0 |
| SEC-01D Generic error responses + rationale | PASS | `grep -c "Internal error" polar-webhook/index.ts` = 1; `grep -c "errorMessage" polar-webhook/index.ts` = 0; `grep -c "service-role required" polar-webhook/index.ts` = 1 |

### 3. Shared-auth migration (25-30 functions)

| Metric | Value |
|--------|------:|
| Migrated this phase (Plan 37-03) | 26 |
| Already migrated (SEC-01E baseline) | 4 |
| Exempt (webhooks + custom auth) | 6 |
| Pre-existing no-JWT pattern (review needed) | 2 |
| **Total** | 38 |

**Verification:** `grep -lr "authHeader.replace('Bearer " supabase/functions/` returns only `mcp-server/index.ts` (expected exempt — custom MCP OAuth). **SEC-02A: PASS.**

### 4. Fresh audit report

- [x] `.planning/security/2026-05-Q2-edge-audit.md` exists.
- [x] Per-function table with 38 rows.
- [x] Verification matrix for SEC-06..12 with file:line evidence.
- [x] 0 new Critical findings.
- [x] 0 new High findings (the 4 polar-webhook SEC-01 items are pre-tracked).
- [x] Severity-rated findings categorized; M-01 (35 rationale-comment gaps) routed to Phase 38; L-01..03 routed to Plan 37-03 or v2.3.

### 5. Deployed-vs-source reconciliation

- [x] `.planning/security/2026-05-Q2-deployed-source-delta.md` exists.
- [x] Snapshot before (77) and after (38) recorded.
- [x] All 39 orphans cross-referenced for callers.
- [x] All 39 confirmed-dead orphans deleted.
- [x] Final deployed count (38) == source count (38).

## Per-SEC-NN Status

| SEC ID | Status | Plan |
|--------|--------|------|
| SEC-01A polar-webhook DRY refactor | DONE | 37-02 |
| SEC-01B polar-webhook EdgeRuntime.waitUntil | DONE | 37-02 |
| SEC-01C polar-webhook strip CORS | DONE | 37-02 |
| SEC-01D polar-webhook generic errors | DONE | 37-02 |
| SEC-01E shared-auth (4 baseline) | PRE-DONE | (pre-phase) |
| SEC-02A shared-auth migration (26 functions) | DONE | 37-03 |
| SEC-02B fresh audit | DONE | 37-01 |
| SEC-05A deployed snapshot | DONE | 37-05 |
| SEC-05B caller cross-reference | DONE | 37-05 |
| SEC-05C orphan deletion | DONE | 37-05 |
| SEC-06 zoom-webhook timing-safe HMAC | PRE-DONE / verified | 37-01 audit |
| SEC-07 webhook replay windows | PRE-DONE / verified | 37-01 audit |
| SEC-08 file-upload magic bytes | PRE-DONE / verified | 37-01 audit |
| SEC-09 OAuth token encryption | PRE-DONE / migration shipped | 37-04 |
| SEC-10 send-org-invite HTML escape | PRE-DONE / verified | 37-01 audit |
| SEC-11 share-call recordings gate | PRE-DONE / verified | 37-01 audit |
| SEC-12 polar-webhook idempotency | PRE-DONE / verified | 37-01 audit |

## Outstanding Manual Operator Actions

1. **SEC-09 ops run** (post-deploy): execute `SELECT encrypt_existing_oauth_tokens('<key>')` against production DB. Runbook at `.planning/security/2026-05-Q2-token-encryption-baseline.md`.

## Tests Not Run This Phase

Per CONTEXT.md "Test Strategy" the following test surfaces were planned but not landed this phase. Tracked to v2.3 BACKLOG:

- Unit tests for `_shared/auth.ts` (101 helper, 401 paths, case-insensitive Bearer).
- Unit tests for `_shared/html-escape.ts` (5 character escapes).
- Unit tests for `_shared/oauth-encrypt.ts` (decrypt with-key/without-key fallback).
- Unit test for `file-upload-transcribe` magic-byte detector (negative test: jpeg bytes claimed as `audio/mpeg` → 400).
- Integration test for polar-webhook idempotency (duplicate svix-id → 200 already_processed, no DB write).
- Integration test for zoom-webhook replay window (timestamp 6 minutes ago → 401).
- CI security smoke test for replay attacks.

Reason: the security fixes already shipped to production in earlier phases (verified by source audit); test coverage is technical debt, not Phase 37 acceptance.
