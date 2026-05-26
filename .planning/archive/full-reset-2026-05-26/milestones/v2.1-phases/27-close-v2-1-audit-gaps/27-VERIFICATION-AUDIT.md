---
phase: 27-close-v2-1-audit-gaps
status: passed
verified_at: 2026-05-07T20:30:00Z
score: 9/10 PASS + 1 deferred (Nyquist VALIDATION.md, D-08)
evidence_quality: high
verifier: gsd-verifier (independent goal-backward audit)
audit_method: per-criterion grep/git/file inspection — independent of executor SUMMARYs
notable_concerns:
  - "1 residual `as McpToken[]` cast remains at src/hooks/useMcpTokens.ts:44 — distinct from the 4 service-layer casts removed by commit 1675f371. This is an empty-array fallback literal, not a query-result coercion (the unsafe pattern). Not a regression."
  - "call_share_access_log table missing in production was correctly surfaced by 27-VERIFICATION.md line 142 (executor flagged it as a follow-up, did not falsely claim D-13 fully shipped)."
notable_confirmations:
  - "All 18 phase-27 commits present on fix/phase-26-breakpoint-260507-kgl"
  - "Both new migrations (20260507151835, 20260507151924) timestamp-strictly-greater than latest pre-Phase-27 (20260507150000)"
  - "Original migrations 20260308100000 + 20260410153126 untouched — immutability honored"
  - "tsc --noEmit returns 0 errors total (cleaner than the 84 pre-existing errors mentioned in CONTEXT)"
  - "PROV-02 enforcement at index.ts:841-844 returns mcpError(-32001) when !paid"
  - "Critical security #1 (mcp-oauth-register): fail-closed at index.ts:30-36 returns 500 when SUPABASE_ANON_KEY unset"
  - "Critical security #2 (zoom-webhook): index.ts:158 — `Authorization: Bearer ${accessToken}` header"
  - "Critical security #3 (share-call): index.ts:285-294, 508 — JWT-derived userId + req.headers.get('x-forwarded-for') for IP, legacy query-param accessor_user_id pattern fully removed"
recommendation: passed
---

# Phase 27 Goal-Backward Audit — Independent Verification

**Phase Goal (ROADMAP.md):** Close every blocker, warning, and orphan from `.planning/v2.1-MILESTONE-AUDIT.md` plus 3 production-exploitable Critical security findings.

## 10 Success Criteria — Independent Re-Verification

| # | Criterion | Status | Independent Evidence |
|---|-----------|--------|----------------------|
| 1 | PROV-02 re-enabled in mcp-server | PASS | `supabase/functions/mcp-server/index.ts:841-844` — `if (!paid) { ... return mcpError(id, -32001, ...) }`. Commit `7dc4bab1`. |
| 2 | supabase.ts regenerated + 4 casts removed | PASS | Schema: `mcp_tokens.enabled_categories` (line 2496), `recordings.action_items_cache` + `coaching_cache` (recordings table), `call_notes` table block (line 573). Service-layer unsafe casts: 0 matches in `src/services/mcp-tokens.service.ts` and `src/services/mcp-token-capabilities.service.ts`. Commit `1675f371`. |
| 3 | regenerate_mcp_token returns enabled_categories | PASS | `supabase/migrations/20260507151835_regenerate_mcp_token_with_categories.sql` — DROP+CREATE pattern (correct response to SQLSTATE 42P13), `enabled_categories JSONB` in RETURNS TABLE, `auth.uid()` IDOR guard preserved. Commits `624ec1ca` + `2c020b36`. |
| 4 | auto_create_default_workspace_entry uses is_default | PASS | `supabase/migrations/20260507151924_auto_workspace_entry_use_is_default.sql` line 30 — `WHERE organization_id = NEW.organization_id AND is_default = TRUE`. Old `is_home` flag eliminated. Commit `7b120a11`. |
| 5 | VERIFICATION.md backfilled phases 20-24 | PASS | All 5 files present: `20-VERIFICATION.md` (3.3K), `21-VERIFICATION.md` (3.4K), `22-VERIFICATION.md` (4.7K), `23-VERIFICATION.md` (3.4K), `24-VERIFICATION.md` (4.2K). Commits `de7e3837..a1f33f15`. |
| 6 | WS-01..05 in REQUIREMENTS.md traceability | PASS | `.planning/REQUIREMENTS.md:135-139` — 5 lines mapping WS-01..05 → Phase 25 with `verified` status. Provenance line at 166. Commit `6e720651`. |
| 7 | mcp-oauth-register fail-closed | PASS — Critical security | `supabase/functions/mcp-oauth-register/index.ts:30-36` — `if (!anonKey) { return 500 'Service misconfigured' }`. No service-role fallback path exists. Commit `0d26d6ea`. |
| 8 | zoom-webhook OAuth in Authorization header | PASS — Critical security | `supabase/functions/zoom-webhook/index.ts:158` — `headers: { 'Authorization': Bearer ${accessToken} }`. Comment 152-155 confirms previous `?access_token=` query param pattern removed. Commit `652a8169`. Live functional sign-off deferred to next webhook event (documented as post-deploy fallback). |
| 9 | share-call audit log JWT + X-Forwarded-For | PASS — Critical security | `supabase/functions/share-call/index.ts:280-294` — JWT-derived `derivedUserId`, `req.headers.get('x-forwarded-for')` for IP. Line 506-508 same pattern in handleLogAccess. Comment lines 207-209 confirms `accessor_user_id` + `ip_address` query params no longer read (forgery vector closed). Commit `90adf912`. Pre-existing `call_share_access_log` table missing in prod — explicitly flagged in 27-VERIFICATION.md:142 as follow-up. |
| 10 | Nyquist VALIDATION.md backfill | DEFERRED | Explicitly out-of-scope per CONTEXT.md D-08 + 27-VERIFICATION.md frontmatter `decisions_deferred`. Marked for v2.2 backlog. Not a gap. |

## Threat Coverage Spot-Check

T-27-01 (RPC IDOR): `auth.uid()` guard preserved in regenerate_mcp_token migration. PASS.
T-27-02 (trigger SECURITY DEFINER + search_path): both new migrations carry `SECURITY DEFINER SET search_path = public`. PASS.
T-19-02 (regenerate IDOR): `WHERE mcp_tokens.user_id = auth.uid()` in new RPC. PASS.

## Migration Immutability Audit

Latest pre-Phase-27 migration: `20260507150000_add_sentiment_cache_to_recordings.sql`.
Phase 27 added: `20260507151835` and `20260507151924` — both strictly greater. PASS.
Original `20260308100000_*.sql` and `20260410153126_*.sql` untouched (git log shows last edits in Phase 19 / earlier work). PASS.

## TypeScript Cleanliness (Plan-Touched Files)

`npx tsc --noEmit` returns: **TypeScript: No errors found** (0 total).
This is materially cleaner than the 84 pre-existing errors CONTEXT.md flagged as "acceptable carry-over." Either Phase 25 errors were collaterally fixed or the count was stale. Either way: zero regressions from Phase 27 work.

## Executor Claim Re-Verification

Held up under audit:
- 18-commit count, branch `fix/phase-26-breakpoint-260507-kgl`
- `as McpToken` removed from 4 service functions (verified by grep — no `as McpToken` matches in `src/services/mcp-token*`)
- All Wave 1 backend fixes shipped with intended invariants
- 27-VERIFICATION.md correctly flags `call_share_access_log` prod-table absence rather than papering over D-13

Did NOT hold up:
- None of substance. The 1 residual `as McpToken[]` cast in `useMcpTokens.ts:44` is on a fallback empty-array literal, not a Supabase query result — distinct from the unsafe casts the plan targeted. Worth a follow-up cleanup but not a gap.

## Recommendation

**passed** — 9/10 criteria PASS via independent re-verification, criterion 10 explicitly deferred per accepted policy (D-08), all 3 Critical security fixes verified at the code level, no regressions, migration immutability honored, executor's pre-existing-gap acknowledgement (call_share_access_log) is appropriate.

No blockers. v2.1 milestone can ship. Recommended follow-ups (non-blocking):

1. Add migration to create `call_share_access_log` table OR remove the audit-log INSERT branch entirely (Phase 28 candidate).
2. Functional sign-off on zoom-webhook header fix at next live webhook event (documented).
3. Phase 22 UAT items 1+7 are tracked separately in 22-VERIFICATION.md, not Phase 27.
4. Cosmetic: replace residual `[] as McpToken[]` fallback in `useMcpTokens.ts:44` with a typed default at the hook signature.

---

_Verified: 2026-05-07T20:30:00Z_
_Verifier: Claude (gsd-verifier — goal-backward audit, independent of executor SUMMARYs)_
