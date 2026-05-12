---
phase: 37
phase_name: Edge Function Security Hardening (Deferred Phase 28 + Audit Close + Orphan Cleanup)
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 37: Edge Function Security Hardening — Context

<domain>
## Phase Boundary

Close all deferred Phase 28 High findings, harden polar-webhook, migrate 25-30 functions to `_shared/auth.ts`, run a fresh comprehensive audit, and reconcile deployed-vs-source.

Categories of work:
1. **SEC-06..12** — 7 High findings from 2026-05-07 audit (zoom-webhook timing-safe HMAC, replay window, file-upload magic-byte validation + streaming, fathom-oauth token encryption, send-org-invite HTML escaping, share-call orphan path, polar-webhook idempotency)
2. **SEC-01A..05C** — polar-webhook refactor + shared-auth migration (per ROADMAP requirement list)
3. **Fresh audit** — comprehensive review of all 38 edge functions with severity-rated findings
4. **Reconciliation** — deployed-vs-source delta cleanup with auto-delete-confirmed-dead policy

Out of scope: frontend RLS audit (Phase 38), AI gating tech debt (Phase 41), share-call response shape (Phase 32 already owns this).
</domain>

<decisions>
## Implementation Decisions

### Token Encryption Key Storage (SEC-09)

**Decision:** Supabase env var `OAUTH_ENCRYPTION_KEY` (256-bit hex string) used by `pgcrypto.pgp_sym_encrypt()`. Single tenant-wide key. Rotation handled via one-shot migration when needed.

**Rationale:** matches existing secret-management pattern; no new infra; cleanly invertible during incident response.

**Implementation:**
- Generate key: `openssl rand -hex 32` → store in Supabase secrets as `OAUTH_ENCRYPTION_KEY`.
- Migration: `pgp_sym_encrypt(token, current_setting('app.oauth_encryption_key'))`; OR pass via edge function env at write time.
- Decryption: edge functions read the secret + decrypt before passing to upstream API.
- Migrate existing plaintext tokens: write a one-shot migration that encrypts all existing rows in `import_sources` and `user_settings` where `oauth_access_token` / `oauth_refresh_token` are plaintext. Verify count before/after.
- Rotation: if key needs to change, write a `rotate-oauth-tokens.sql` script that decrypts with old key and re-encrypts with new. Document in runbook.

### Deployed-vs-Source Reconciliation Policy

**Decision:** Auto-delete confirmed-dead functions; list ambiguous ones for user review.

**Confirmed-dead criteria (auto-delete):**
- Function deployed but no source file in `supabase/functions/`
- Zero callers in `git log -p src/ supabase/ --since="90 days"`  AND zero Supabase logs in the last 30 days (`supabase functions logs <name> --since 30d` returns empty)

**Ambiguous (list for user approval):**
- Function deployed, no source, but has Supabase logs in last 30 days
- Function deployed, no source, referenced in any active edge function
- Function name matches a deprecated alias (e.g., old name kept around)

Output: `.planning/security/2026-05-Q2-deployed-source-delta.md` with two sections (auto-deleted + needs-decision).

### Shared-Auth Migration (SEC-01A..05C)

**Decision:** Migrate 25-30 user-JWT-authenticated functions to `supabase/functions/_shared/auth.ts` `authenticateRequest()` helper. Maintain exempt list:

**Exempt from migration (webhooks + OAuth metadata callbacks):**
- `polar-webhook` — Polar signs requests; no JWT
- `zoom-webhook` — Zoom HMAC signature; no JWT
- `fathom-webhook` (if it exists)
- `polar-customer-state` callback (if Polar-signed)
- `*-oauth-callback` functions — code exchange, no JWT yet
- `share-call?token=...` (public path) — token IS the credential

**Migration approach:**
1. Build `_shared/auth.ts authenticateRequest(req: Request, supabase: SupabaseClient): Promise<{ user, error? }>` if it doesn't exist already, OR audit existing helper.
2. Replace every `authHeader.replace('Bearer ', '')` + `supabase.auth.getUser(token)` block with single helper call.
3. Add tests that verify the helper returns 401 on missing/invalid JWT.
4. Commit per function batched by 5-10 to keep diffs reviewable.

### Fresh Audit Methodology

Produce `.planning/security/2026-05-Q2-edge-audit.md` covering all 38 edge functions:

**Per-function audit checklist:**
- [ ] CORS preflight present
- [ ] JWT authentication or alternative explicit auth (webhook signature, token-as-credential, etc.)
- [ ] User ownership checks even where RLS provides coverage (defense-in-depth)
- [ ] Input validated with Zod
- [ ] Errors logged without sensitive data (no tokens, API keys, PII in console logs)
- [ ] Service-role rationale documented at top of file
- [ ] Rate limiting where appropriate
- [ ] Idempotency for state-changing webhooks
- [ ] No `===` on signature comparison (use `crypto.subtle.timingSafeEqual`)
- [ ] Timestamp replay window for signed requests
- [ ] No HTML interpolation in email bodies without escaping
- [ ] Magic-byte validation for file uploads

**Severity ratings:** Critical / High / Medium / Low / Info per finding. Critical and High MUST be fixed before phase closes. Medium/Low documented with deferred fix recommendation.

### Specific Fixes (SEC-06..12)

- **SEC-06** `zoom-webhook` HMAC: replace `===` with `crypto.subtle.timingSafeEqual` (use Deno's WebCrypto). Verify HMAC and timing-safe comparison via unit test that exercises a wrong signature.
- **SEC-07** `zoom-webhook` + `polar-webhook`: 5-minute replay window. Compare `x-zm-request-timestamp` (Zoom) and the equivalent Polar header against `Date.now()`. Reject if `>5min` delta.
- **SEC-08** `file-upload-transcribe`: magic-byte validation (MP3 `0xFF 0xFB`, WAV `RIFF`, MP4 `ftyp`, M4A, OGG, FLAC). Switch from `req.formData()` to streaming (manual multipart parse OR Deno-native `ReadableStream` boundary detection). Limit to 25MB total.
- **SEC-09** `fathom-oauth-callback`: pgcrypto encryption per the key decision above.
- **SEC-10** `send-org-invite`: create `_shared/html-escape.ts` (basic `&` `<` `>` `"` `'` replacement; consider entity encoding library if more thorough). Route all email-body interpolation through it. Audit all other email-sending functions for the same vulnerability.
- **SEC-11** `share-call handleCreateShareLink`: require a `recordings` row before allowing share link. Migrate legacy data that lacks a recordings row OR explicitly block + return clear error.
- **SEC-12** `polar-webhook`: copy `processed_webhooks` idempotency pattern from `zoom-webhook`. Each Polar event ID gets a row in `processed_polar_webhooks` table; duplicates short-circuit early.

### Polar-Webhook Specific Hardening

- Refactor duplicate subscription handlers to a single helper.
- Wrap MCP provisioning in `EdgeRuntime.waitUntil` (so Polar gets a fast 200 response).
- Strip the CORS apparatus entirely — webhooks are server-to-server, no browser ever calls them.
- Error responses: return generic `{ "error": "Internal error" }` to Polar; full detail goes to `console.error` (Supabase logs only).

### Test Strategy

- **Unit tests** for every new helper (`_shared/auth.ts`, `_shared/html-escape.ts`, magic-byte detector).
- **Integration tests** for webhook signature verification (timing-safe + replay window).
- **Manual penetration test** for each SEC-NN: craft an attack payload, confirm the fix rejects it.
- **CI security smoke test**: replay attack against webhook signed >5min ago should return 401/403.
- Real-DB integration tests for token encryption (insert ciphertext, decrypt, confirm roundtrip).

### Sequencing

1. **Audit first** — produce the comprehensive audit doc; surface anything not in SEC-06..12.
2. **Critical/High fixes from new audit** — fix anything Critical or new High found.
3. **SEC-06, SEC-12, SEC-07** — webhook hardening (least risk of breakage).
4. **SEC-09** — OAuth token encryption (migration + edge function updates atomic).
5. **SEC-10, SEC-08** — email escaping + file upload.
6. **SEC-11** — share-call recordings-row requirement.
7. **SEC-01..05** — polar-webhook refactor + shared-auth migration (batched).
8. **Reconciliation cleanup** — auto-delete confirmed-dead.
</decisions>

<code_context>
## Existing Code Insights

**Reference docs:**
- `~/.claude/projects/-Users-Naegele-dev-brain/memory/project_security_audit_2026_05_07.md` — original audit
- `supabase/functions/_shared/` — shared utilities (potential auth.ts location)
- `supabase/functions/zoom-webhook/index.ts` — has `processed_webhooks` idempotency pattern to copy
- `supabase/functions/polar-webhook/index.ts` — needs SEC-12 idempotency, SEC-07 replay window, refactor
- `supabase/functions/fathom-oauth-callback/index.ts` — SEC-09 token encryption
- `supabase/functions/file-upload-transcribe/index.ts` — SEC-08 magic-byte + streaming
- `supabase/functions/send-org-invite/index.ts` — SEC-10 HTML escape
- `supabase/functions/share-call/index.ts` — SEC-11 recordings-row requirement (Phase 32 also touches this)

**Critical dependencies:**
- Phase 32 modifies `share-call` for response shapes — coordinate with SEC-11 work.
- `_shared/auth.ts` is the foundation; Phase 38 also relies on it.
</code_context>

<specifics>
## Requirements (from REQUIREMENTS.md)

- **SEC-01A..05C** — polar-webhook refactor + shared-auth migration
- **SEC-06** — zoom-webhook timing-safe HMAC
- **SEC-07** — zoom-webhook + polar-webhook 5-minute replay window
- **SEC-08** — file-upload-transcribe magic-byte + streaming
- **SEC-09** — fathom-oauth-callback token encryption
- **SEC-10** — send-org-invite HTML escape
- **SEC-11** — share-call recordings-row gate
- **SEC-12** — polar-webhook idempotency

## Success Criteria (from ROADMAP.md)

1. All 7 deferred High findings fixed.
2. polar-webhook hardened (refactor + waitUntil + CORS strip + generic errors).
3. 25-30 functions migrated to `_shared/auth.ts`.
4. Fresh audit report with all new Critical/High fixed.
5. Deployed-vs-source delta reconciled; confirmed orphans deleted.

## Verification Strategy

- Fresh audit document committed.
- Penetration test results per SEC-NN.
- `supabase functions list` snapshot before + after orphan cleanup.
- Real-DB integration tests for token encryption roundtrip.
- CI security smoke tests passing.
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 37
- `.planning/REQUIREMENTS.md` — SEC-01..12
- `~/.claude/projects/-Users-Naegele-dev-brain/memory/project_security_audit_2026_05_07.md` — original 2026-05-07 audit
- `supabase/CLAUDE.md` — security requirements, RLS patterns
- `supabase/functions/_shared/` — shared utilities
- `supabase/functions/zoom-webhook/index.ts` — idempotency pattern reference
- Existing `processed_webhooks` table — schema reference
- OWASP Top 10 — general security baseline
</canonical_refs>

<deferred>
## Deferred Ideas

- **Per-org encryption keys** — multi-tenant key isolation. Adds complexity, defer until compliance/audit requires it.
- **Cloud HSM / KMS** — hardware-backed key management. Defer until enterprise customers require it.
- **Automated dependency vulnerability scanning** — Renovate / Dependabot integration. Overlaps with Phase 38 npm audit; defer the automation piece.
- **WAF / DDoS protection** — Cloudflare in front of Supabase edge functions. Defer unless we see attack patterns.
- **Audit logging dashboard** — visualize edge function security events. Defer to v2.3.
</deferred>
