---
phase: 27-close-v2-1-audit-gaps
status: verified
verified_at: 2026-05-07T20:10:00Z
score: "10/10 success criteria — 9 closed by Phase 27 (1-9 PASS), 1 deferred per D-08 (criterion 10 — Nyquist VALIDATION.md backfill)"
source_evidence:
  - "27-WAVE1-VERIFY.md"
  - "27-01-SUMMARY.md"
  - "27-02-SUMMARY.md (this plan)"
  - ".planning/phases/20-read-crud-tools/20-VERIFICATION.md (backfilled this plan)"
  - ".planning/phases/21-write-crud-tools/21-VERIFICATION.md (backfilled this plan)"
  - ".planning/phases/22-ai-tools/22-VERIFICATION.md (backfilled this plan)"
  - ".planning/phases/23-management-ui/23-VERIFICATION.md (backfilled this plan)"
  - ".planning/phases/24-fathom-share-link-save/24-VERIFICATION.md (backfilled this plan)"
decisions_closed:
  - "D-01: PROV-02 plan-gating re-enabled with -32001 mcpError"
  - "D-02: curl evidence captured for PROV-02 against free-tier user (a@vibeos.com)"
  - "D-03: supabase.ts regenerated; 4 schema additions present; 4 `as McpToken` casts removed"
  - "D-04: regenerate_mcp_token RPC includes enabled_categories (DROP+CREATE migration due to 42P13)"
  - "D-05: auto_create_default_workspace_entry uses is_default (not is_home)"
  - "D-06: VERIFICATION.md backfilled for phases 20, 21, 22, 23, 24"
  - "D-07: WS-01..05 added to REQUIREMENTS.md traceability table"
  - "D-09: Plan structure (single phase, 2 waves: backend then frontend/docs)"
  - "D-10: 9 verification gates (curl + tsc + SQL spot-checks)"
  - "D-11: mcp-oauth-register fail-closed (Critical Security #1)"
  - "D-12: zoom-webhook OAuth token in Authorization header (Critical Security #2)"
  - "D-13: share-call audit log de-poisoned via JWT-derive (Critical Security #3)"
decisions_deferred:
  - "D-08: Nyquist VALIDATION.md backfill (deferred to v2.2 backlog per CONTEXT.md)"
threats_mitigated:
  - "T-27-01: regenerate_mcp_token IDOR guard preserved (auth.uid + SECURITY DEFINER + search_path)"
  - "T-27-02: auto-workspace-entry search_path lock preserved + ON CONFLICT idempotency"
  - "T-27-03: share-call JWT-derive does not block on getUser failure (existing swallow preserved)"
  - "T-27-04: zoom-webhook header pattern verified (or fallback documented)"
  - "T-27-05: mcp-oauth-register fail-closed on missing anon key"
  - "T-27-06: share-call audit log poisoning closed — query param parsing removed"
  - "T-27-07: PROV-02 free-tier callers get -32001 (handshake methods remain ungated)"
  - "T-27-08: supabase.ts CLI banner pollution — regen produced clean output, no banner appended"
  - "T-27-09: VERIFICATION.md status accuracy preserved — Phase 22 retains human_needed; Phase 20 retains backfilled-from-evidence"
human_verification:
  - test: "Connect MCP client to a paid-tier production token and call any callvault tool"
    expected: "Tool succeeds; response is valid; subsequent free-tier flip returns -32001 (Wave 1 Gate 1 already verified this for a@vibeos.com via SQL flip)"
    why_human: "Live MCP-client session against production endpoint adds Phase 22 UAT items 1+7 coverage (deferred separately)"
    result: "deferred (Phase 22 UAT residual)"
  - test: "Trigger a live Zoom webhook (next inbound recording) and confirm transcript downloads via header-based OAuth"
    expected: "recordings table gains a row with source_app='zoom'; no token leakage in any log"
    why_human: "Requires a live Zoom webhook event in production"
    result: "deferred-followup (next live Zoom webhook will validate; documented fallback exists)"
---

# Phase 27 Verification

## Goal

Close every blocker, warning, and orphan surfaced by `.planning/v2.1-MILESTONE-AUDIT.md` PLUS the 3 production-exploitable Critical security findings from the 2026-05-07 Edge Function security audit, so v2.1 can ship at `passed` status with no known critical security holes.

## Success Criteria Status (matches ROADMAP 1-10)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | PROV-02 re-enabled (mcpError -32001 returned to free-tier callers) | ✅ verified | 27-WAVE1-VERIFY.md Gate 1 — live curl returned exact `-32001` body for a@vibeos.com after `product_id=NULL` flip; account fully restored. Commit `7dc4bab1`. |
| 2 | supabase.ts regenerated + 4 schema additions present + casts removed | ✅ verified | 27-02 Task 1 — `enabled_categories` (4 refs), `action_items_cache` (3), `coaching_cache` (3), `call_notes` (3), `regenerate_mcp_token` (1) present in `src/types/supabase.ts`; 4 `as McpToken` casts removed; `npx tsc --noEmit` returned 0 errors. Commit `1675f371`. |
| 3 | regenerate_mcp_token RPC enabled_categories | ✅ verified | 27-WAVE1-VERIFY.md Gate 2 — `pg_get_functiondef` shows `RETURNS TABLE(... enabled_categories jsonb)` + auth.uid IDOR guard + SECURITY DEFINER + search_path lock. Commits `624ec1ca`, `2c020b36` (DROP+CREATE deviation). |
| 4 | auto_create_default_workspace_entry uses is_default | ✅ verified | 27-WAVE1-VERIFY.md Gate 3 — `pg_get_functiondef` shows `is_default = TRUE`; `is_home` absent from function body; SECURITY DEFINER + search_path + ON CONFLICT preserved. Commit `7b120a11`. |
| 5 | VERIFICATION.md backfilled for phases 20, 21, 22, 23, 24 | ✅ verified | 5 files exist with valid frontmatter. Commits `de7e3837` (20), `eaa02a96` (21), `7ff2282c` (22), `cd9d7459` (23), `a1f33f15` (24). |
| 6 | WS-01..05 in REQUIREMENTS.md | ✅ verified | 27-02 Task 2 — `### Workspace Type Retirement (Phase 25)` section + 5 traceability rows + 5 wording bullets; Coverage updated 21→26 active, 15→20 shipped. Commit `6e720651`. |
| 7 | mcp-oauth-register fail-closed | ✅ verified | 27-WAVE1-VERIFY.md Gate 4 — 0 references to `SUPABASE_SERVICE_ROLE_KEY` in source; `if (!anonKey)` guard returns 500 `Service misconfigured`. Commit `0d26d6ea`. |
| 8 | zoom-webhook OAuth header | ✅ verified | 27-WAVE1-VERIFY.md Gate 5 — `?access_token=${accessToken}` URL pattern absent; `Authorization: Bearer ${accessToken}` header present; functional sign-off deferred to next live Zoom webhook with documented fallback. Commit `652a8169`. |
| 9 | share-call audit log de-poisoned | ✅ verified | 27-WAVE1-VERIFY.md Gate 6 — `searchParams.get('accessor_user_id'/'ip_address')` removed; `supabaseClient.auth.getUser` for JWT-derive (1 ref); `x-forwarded-for` for IP (3 refs); live forge attempt 404'd before insert. Commit `90adf912`. |
| 10 | (Optional) Nyquist VALIDATION.md backfill | ⏳ deferred | D-08 — explicitly out of scope per 27-CONTEXT.md `<deferred>` section; defer to v2.2 backlog. |

## Requirements Coverage

| Req | Phase | Status | Evidence |
|-----|-------|--------|----------|
| PROV-02 | Phase 19 | ✅ re-satisfied (Phase 27 D-01) | `mcpError(-32001)` returned to free-tier callers; verified live in 27-WAVE1-VERIFY Gate 1 |
| MGMT-02 | Phase 23 | ✅ now type-safe | `enabled_categories` column generated in `src/types/supabase.ts`; `as McpToken` cast in `setEnabledCategories` removed |
| WS-01..05 | Phase 25 | ✅ now traceable | added to `.planning/REQUIREMENTS.md` traceability table |

## Threat Model Closure (T-27-01..09)

| Threat | Component | Status | Evidence |
|--------|-----------|--------|----------|
| T-27-01 (E) | regenerate_mcp_token RPC IDOR | mitigated | `pg_get_functiondef` shows `auth.uid()` IDOR guard + SECURITY DEFINER + search_path lock (Gate 2) |
| T-27-02 (E/T) | auto_create_default_workspace_entry trigger | mitigated | `pg_get_functiondef` shows `SECURITY DEFINER` + `SET search_path TO 'public'` + ON CONFLICT (Gate 3) |
| T-27-03 (I/D) | share-call JWT-derive perf | mitigated | `await supabaseClient.auth.getUser()` only when Authorization header present; existing "don't fail on log error" behavior preserved |
| T-27-04 (I) | zoom-webhook header pattern | mitigated | URL-token pattern removed (Gate 5 grep); Authorization header in place; fallback documented |
| T-27-05 (E) | mcp-oauth-register fail-closed | mitigated | Service-role fallback removed; live deployed function returns 400 not 500 (anon key configured); 500 path triggers only on misconfig (Gate 4) |
| T-27-06 (T/R) | share-call audit log poisoning | mitigated | Query-param parsing removed; live forge attempt 404'd at call-fetch before insert (Gate 6) |
| T-27-07 (I) | PROV-02 plan-gating | mitigated | Live curl on free-tier user returned exact -32001 message; `initialize` and `tools/list` remain ungated (Gate 1) |
| T-27-08 (T) | supabase.ts banner pollution | mitigated | Wave 2 Task 1 — regen produced clean file; last meaningful line `} as const`; no trailing CLI banner |
| T-27-09 (I) | VERIFICATION.md frontmatter overstating | accepted/mitigated | Phase 20 status: `backfilled-from-evidence`; Phase 22 status: `human_needed`; Phase 21 splits TOOL-05 verified vs TOOL-06/07 partial. No claim is upgraded beyond what evidence supports. |

## Production Impact

- Free-tier MCP callers now blocked (was: open access since Phase 20 hot-fix `8f0b9a17`)
- 3 production-exploitable security holes closed (mcp-oauth-register open-proxy, zoom-webhook URL token, share-call audit-log forgery)
- v2.1 milestone audit gaps fully addressed
- Frontend `as McpToken` casts removed — TypeScript safety restored on the MCP token services
- Schema migrations applied: regenerate_mcp_token RPC + auto_create_default_workspace_entry trigger now match Phase 25's contract

## Commit Trail (Phase 27 — both Waves)

**Wave 1 (Backend, 8 commits):**
- `7dc4bab1` — feat: re-enable PROV-02 plan-gating in mcp-server
- `0d26d6ea` — fix: mcp-oauth-register fail-closed (Security Critical #1)
- `652a8169` — fix: zoom-webhook OAuth header (Security Critical #2)
- `90adf912` — fix: share-call audit log JWT-derive (Security Critical #3)
- `624ec1ca` — feat: migration regenerate_mcp_token + enabled_categories
- `2c020b36` — fix: migration deviation (DROP+CREATE for 42P13)
- `7b120a11` — feat: migration auto_create_default_workspace_entry → is_default
- `3664f38d` — test: Wave 1 verification evidence
- `ae30dc9d` — docs: Wave 1 SUMMARY

**Wave 2 (Frontend + Docs, 7 commits as of this VERIFICATION):**
- `1675f371` — refactor: regen supabase.ts + remove as McpToken casts
- `6e720651` — docs: add WS-01..05 to REQUIREMENTS.md
- `de7e3837` — docs: backfill 20-VERIFICATION.md
- `eaa02a96` — docs: backfill 21-VERIFICATION.md
- `7ff2282c` — docs: backfill 22-VERIFICATION.md
- `cd9d7459` — docs: backfill 23-VERIFICATION.md
- `a1f33f15` — docs: backfill 24-VERIFICATION.md
- (this commit: 27-VERIFICATION.md + final docs commit)

**Total: 16 commits across Phase 27 (Wave 1 + Wave 2 + final docs).**

## v2.1 Milestone Status

Per the v2.1-MILESTONE-AUDIT.md closure path, all 6 audit items are addressed:

1. ✅ BLOCKER #1 (PROV-02 plan-gating disabled) — fixed (D-01, Wave 1)
2. ✅ BLOCKER #2 (supabase.ts missing 4 schema members) — fixed (D-03, Wave 2)
3. ✅ WARNING #1 (regenerate_mcp_token return shape) — fixed (D-04, Wave 1)
4. ✅ WARNING #2 (is_home/is_default drift in trigger) — fixed (D-05, Wave 1)
5. ✅ ORPHAN (WS-01..05 not in REQUIREMENTS.md) — fixed (D-07, Wave 2)
6. ✅ VERIFICATION GAP (5 phases without VERIFICATION.md) — fixed (D-06, Wave 2)

**Recommendation:** Update `.planning/v2.1-MILESTONE-AUDIT.md` status from `gaps_found` to `passed` (out of scope for this plan — handled by next milestone audit run via `/gsd-audit-milestone`).

## Pre-existing Gaps Surfaced (out-of-scope, flag for follow-up)

- **`call_share_access_log` table missing in production** (Wave 1 Gate 6 SQL spot-check — `to_regclass` returned NULL). Pre-fix audit-log INSERT was already silently failing in production (caught by the existing `// Don't fail if logging fails` swallow). The Phase 27 fix closes the *forgery vector*, not the missing table. Recommend a follow-up plan to either add the table migration or remove the audit-log branch entirely if no longer wanted.
- **No live Zoom webhook in last 24h** — Gate 5 functional sign-off deferred to next live Zoom webhook event.
- **`a@vibeos.com` is the only user with an MCP token** — broader Gate 1 coverage was not possible because trial-provisioning grants every signup a paid trial, leaving no naturally free-tier MCP users.

## Self-Check

| Gate | Decision | Status | Evidence Source |
|------|----------|--------|-----------------|
| 1 | D-01 PROV-02 plan-gating | PASS | Live curl with safe rollback — `27-WAVE1-VERIFY.md` Gate 1 |
| 2 | D-04 RPC return shape | PASS | `pg_get_functiondef` against production — `27-WAVE1-VERIFY.md` Gate 2 |
| 3 | D-05 trigger function body | PASS | `pg_get_functiondef` against production — `27-WAVE1-VERIFY.md` Gate 3 |
| 4 | D-11 mcp-oauth-register | PASS (code-grep + deployment) | Source grep + live deploy 400 (not 500) — `27-WAVE1-VERIFY.md` Gate 4 |
| 5 | D-12 zoom-webhook header | PASS (code-grep) | URL pattern absent; functional follow-up on next live webhook |
| 6 | D-13 share-call audit log | PASS | Source grep + live forge 404'd before insert — `27-WAVE1-VERIFY.md` Gate 6 |
| 7 | D-03 tsc clean for service files | PASS | `npx tsc --noEmit` returned 0 errors total after Task 1 |
| 8 | D-07 REQUIREMENTS rows | PASS | 5 WS-0[1-5] rows present + 5 wording bullets + Coverage 26 active |
| 9 | D-06 5 VERIFICATION.md exist | PASS | All 5 files written with valid frontmatter (phases 20, 21, 22, 23, 24) |

---

_Verified 2026-05-07T20:10:00Z by Claude (Phase 27 Plan 02 — final closure)_
