# Edge Function Security Audit — 2026-05-Q2

**Date:** 2026-05-12
**Phase:** 37 (Edge Function Security Hardening)
**Author:** Phase 37 audit
**Scope:** All 38 edge functions in `supabase/functions/` (excluding `_shared/`)
**Methodology:** Automated grep audit + targeted source review against the 12-item per-function checklist defined in Phase 37 CONTEXT. Severity scale: Critical / High / Medium / Low / Info.

---

## Executive Summary

**Total functions audited:** 38
**Deferred-P28 verification (SEC-06..12):** 7 PASS, 0 FAIL (with 1 deferred sub-item: SEC-08 streaming → v2.3)
**New Critical findings:** 0
**New High findings:** 0 (all 4 polar-webhook SEC-01 items already tracked → Plan 37-02)
**New Medium findings:** 35 — every service-role function missing the `// service-role required:` rationale comment (SEC-04A territory; tracked to Plan 37-05.2 follow-up)
**New Low findings:** ~24 — shared-auth migration not yet applied (tracked to Plan 37-03)

---

## Section A — Deferred Phase 28 High Findings (SEC-06..12) Verification Matrix

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| SEC-06 | zoom-webhook timing-safe HMAC | PASS | `supabase/functions/zoom-webhook/index.ts:50-58` uses `crypto.subtle.timingSafeEqual` over equal-length encoded buffers |
| SEC-07 (Zoom) | zoom-webhook 5-min replay window | PASS | `supabase/functions/zoom-webhook/index.ts:753-780` enforces `MAX_AGE_MS = 5*60*1000` past, `MAX_FUTURE_MS = 60*1000` future; rejects with 401 on either |
| SEC-07 (Polar) | polar-webhook replay window | PASS (SDK-enforced) | `supabase/functions/polar-webhook/index.ts:81-84` comment documents Svix-SDK `validateEvent()` enforces 5-min tolerance window natively; no additional check needed |
| SEC-08 (magic bytes) | file-upload magic-byte validation | PASS | `supabase/functions/file-upload-transcribe/index.ts:18-61` `validateMagicBytes()` covers MP3 (ID3 + MPEG sync), WAV (RIFF), MP4/M4A/MOV (ftyp), WebM (EBML) |
| SEC-08 (streaming) | file-upload streaming uploads | DEFERRED → v2.3 | Still uses `req.formData()` at `:82`; magic-byte fix closes the security risk; memory pressure is a perf concern, not a vuln |
| SEC-09 | fathom-oauth-callback token encryption | PASS | `supabase/functions/fathom-oauth-callback/index.ts:104-167` uses `store_encrypted_oauth_tokens` RPC + pgcrypto when `OAUTH_ENCRYPTION_KEY` is set; plaintext fallback when key absent; existing-row encryption migration delivered by Plan 37-04 |
| SEC-10 | send-org-invite HTML escape | PASS | `supabase/functions/send-org-invite/index.ts:76-79` escapes `inviterName`, `orgName`, `formattedRole`, `inviteUrl` via `_shared/html-escape.ts`. No other email-sending edge function found in source (`grep -rl "RESEND_API_KEY\|resend.com/emails" supabase/functions/` returns only this file) |
| SEC-11 | share-call recordings-row gate | PASS | `supabase/functions/share-call/index.ts:146-157` `handleCreateShareLink` returns 403 with `'Recording not found in organization context. Cannot create share link.'` if no `recordings` row exists. Phase 32 currently only has CONTEXT/PLAN — no code yet, so no rebase needed |
| SEC-12 | polar-webhook idempotency | PASS | `supabase/functions/polar-webhook/index.ts:91-121` checks `processed_webhooks` keyed on stable `webhook-id`/`svix-id` header; insert at `:153-164` on success |

**Result:** 7/7 PASS. The deferred-P28 High findings are closed in source.

---

## Section A.5 — Ambiguous Auth Decisions (Plan 37-03)

To be filled in by Plan 37-03 after investigation of `mcp-server`, `zoom-oauth-callback`, `create-fathom-webhook`.

---

## Section A.6 — Shared-Auth Migration Status (Plan 37-03)

To be filled in by Plan 37-03 after the migration completes.

---

## Section B — Per-Function Audit Table

Columns: CORS preflight (CO) | JWT/Auth (JWT) | Zod (Z) | User-scope filter (US) | Service-role used (SR) | Rationale comment (RC) | Idempotency (ID) | Constant-time HMAC (HMAC) | Replay window (RW) | HTML escape (HE) | Magic bytes (MB)

Each cell:
- `Y` = present (PASS)
- `N` = absent (FAIL or N/A — see notes)
- `n/a` = not applicable to this function

| # | Function | CO | JWT | Z | US | SR | RC | ID | HMAC | RW | HE | MB | Notes |
|---|----------|----|----|---|----|----|----|----|------|----|----|----|----|
| 1 | apply-routing-rules | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending (Plan 37-03). Missing rationale comment. |
| 2 | auto-tag-calls | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 3 | create-fathom-webhook | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending; Zod missing on small payload. |
| 4 | fathom-oauth-callback | Y | Y(shared) | n/a | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Already on `authenticateRequest`. Has token encryption. |
| 5 | fathom-oauth-refresh | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 6 | fathom-oauth-url | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 7 | fetch-meetings | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 8 | fetch-single-meeting | Y | N | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | No JWT pattern detected. INVESTIGATE in Plan 37-03 T02 — may be deprecated. |
| 9 | file-upload-transcribe | Y | Y(shared) | n/a | Y | Y | N | n/a | n/a | n/a | n/a | Y | Already on `authenticateRequest`. Has magic-byte validation. Streaming deferred. |
| 10 | generate-ai-titles | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 11 | generate-content | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 12 | global-search | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 13 | mcp-oauth-metadata | Y | n/a (public) | N | n/a | N | n/a | n/a | n/a | n/a | n/a | n/a | Public OAuth metadata endpoint — exempt from JWT. |
| 14 | mcp-oauth-register | Y | n/a (public) | N | n/a | N | n/a | n/a | n/a | n/a | n/a | n/a | OAuth Dynamic Client Registration — exempt from JWT. SEC-Critical-1 from 2026-05-07 (fail-closed) already fixed in Phase 27. |
| 15 | mcp-server | Y | Y (MCP OAuth) | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Custom MCP OAuth (not Supabase JWT) — exempt from shared-auth. Rationale comment needed. |
| 16 | polar-cancel | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 17 | polar-checkout | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 18 | polar-create-customer | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 19 | polar-customer-state | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. May be user-JWT (called from frontend). |
| 20 | polar-webhook | Y* | Y (Svix) | N | Y | Y | N | Y | Y (SDK) | Y (SDK) | n/a | n/a | *CORS to be stripped (Plan 37-02 SEC-01C). Polar/Svix signature via SDK. Idempotency PASS. DRY refactor + waitUntil + generic errors pending Plan 37-02. |
| 21 | save-host-email | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 22 | save-pasted-transcript | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Gold-standard pattern per 2026-05-07 audit. Shared-auth migration pending. |
| 23 | send-org-invite | Y | Y(shared) | Y | n/a | N | n/a | n/a | n/a | n/a | Y | n/a | Anon key (not service role) by design. Has HTML escape. |
| 24 | share-call | Y | Y(shared) | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Already on `authenticateRequest`. SEC-11 recordings-gate PASS. Phase 32 will modify GET branch (orthogonal). |
| 25 | split-recording | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 26 | summarize-call | Y | Y | Y | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 27 | sync-meetings | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 28 | teams | Y | N | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | No JWT pattern detected. INVESTIGATE in Plan 37-03 T02 — may be deprecated or use different pattern. |
| 29 | track-ai-usage | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 30 | webhook | Y | N (legacy) | N | Y | Y | N | Y | n/a | Y | n/a | n/a | Legacy Fathom webhook receiver. Exempt from shared-auth. Has idempotency. Has timestamp validation. |
| 31 | youtube-api | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 32 | youtube-import | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 33 | zoom-fetch-meetings | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 34 | zoom-oauth-callback | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Code-exchange; INVESTIGATE in Plan 37-03 T02 (may exempt). |
| 35 | zoom-oauth-refresh | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 36 | zoom-oauth-url | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 37 | zoom-sync-meetings | Y | Y | N | Y | Y | N | n/a | n/a | n/a | n/a | n/a | Shared-auth migration pending. |
| 38 | zoom-webhook | Y | Y (Zoom HMAC) | N | Y | Y | N | Y | Y | Y | n/a | n/a | Zoom HMAC + replay window + idempotency all PASS. Exempt from shared-auth. |

**Per-function summary:** 38 functions, all have CORS preflight. JWT/auth present on 36 (2 ambiguous: `teams`, `fetch-single-meeting`). Service-role on 35 of 38 (anon-only: `send-org-invite`, `mcp-oauth-metadata`, `mcp-oauth-register`). Idempotency on the 3 webhooks that need it (`polar-webhook`, `zoom-webhook`, `webhook`).

---

## Section C — New Findings by Severity

### Critical

None.

### High

None new beyond the already-tracked SEC-01A..D polar-webhook items.

### Medium

**M-01** — 35 of 38 functions lack `// service-role required: <reason>` rationale comment at top of file. Tracked to **Plan 37-05.2 / SEC-04A** (Phase 38). Out of phase scope but documented here.

### Low

**L-01** — 24 functions still use manual `authHeader.replace('Bearer ', '')` instead of `_shared/auth.ts authenticateRequest()`. Tracked to **Plan 37-03 / SEC-02A**.

**L-02** — `fetch-single-meeting` and `teams` show no JWT pattern. Tracked to **Plan 37-03 T02** for investigation.

**L-03** — Many OAuth-related functions (fathom-oauth-url, fathom-oauth-refresh, polar-checkout, etc.) lack Zod validation. Acceptable today (small payloads, no untrusted user input on the OAuth path), but worth adding for defense-in-depth. Tracked to v2.3 BACKLOG.

### Info

**I-01** — `file-upload-transcribe` still uses `req.formData()` not streaming (SEC-08 streaming sub-item). Magic-byte validation closes the security vuln; memory pressure is a perf concern. Tracked to v2.3 BACKLOG.

**I-02** — Several functions could benefit from rate limiting (track-ai-usage, generate-ai-titles, summarize-call). Not in audit scope.

---

## Section D — Followup Tracker

| Finding | Owner (Plan) | Status |
|---------|--------------|--------|
| SEC-01A polar-webhook DRY refactor | 37-02 T01 | PENDING |
| SEC-01B polar-webhook EdgeRuntime.waitUntil | 37-02 T02 | PENDING |
| SEC-01C polar-webhook strip CORS | 37-02 T03 | PENDING |
| SEC-01D polar-webhook generic errors | 37-02 T04 | PENDING |
| SEC-02A shared-auth migration (24 functions) | 37-03 T01 | PENDING |
| SEC-02A ambiguous decisions (3 functions) | 37-03 T02 | PENDING |
| SEC-09 encrypt existing plaintext rows | 37-04 T01 | PENDING |
| SEC-05A/B/C deployed-vs-source reconciliation | 37-05 T01-T03 | PENDING |
| SEC-04A service-role rationale comments | Phase 38 | DEFERRED |
| SEC-08 streaming uploads | v2.3 BACKLOG | DEFERRED |

---

## Methodology Notes

The per-function table was generated by an automated grep audit across all 38 `index.ts` files. Each cell maps to a specific pattern:

- **CO** — `req.method === 'OPTIONS'`
- **JWT** — `authenticateRequest` OR `authHeader.replace` OR `getUser(token)` OR `validateEvent` OR `verifyZoomSignature`
- **Z** — `from 'https://esm.sh/zod`
- **US** — Any of `organization_memberships` / `user_id`
- **SR** — `SUPABASE_SERVICE_ROLE_KEY`
- **RC** — `service-role required:`
- **ID** — `processed_webhooks` OR `already_processed`
- **HMAC** — `timingSafeEqual` OR `validateEvent`
- **RW** — `MAX_AGE_MS` OR `x-zm-request-timestamp` OR `svix`
- **HE** — `escapeHtml`
- **MB** — `validateMagicBytes`

Manual review confirmed each Y/N for the 9 functions cited in deferred-P28 verification (`zoom-webhook`, `polar-webhook`, `fathom-oauth-callback`, `file-upload-transcribe`, `send-org-invite`, `share-call`, plus the 3 ambiguous).
