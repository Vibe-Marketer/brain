---
phase: 27-close-v2-1-audit-gaps
plan: 02
subsystem: planning + frontend types
tags: [audit-closure, type-regen, requirements-traceability, verification-backfill, milestone]
wave: 2
status: complete
completed_at: 2026-05-07T20:15Z
duration_minutes: ~30
dependency_graph:
  requires:
    - "27-01 (Wave 1) — RPC + trigger migrations applied; Edge Function fixes deployed"
  provides:
    - "Canonical generated types in src/types/supabase.ts (4 schema additions)"
    - "TypeScript safety restored on MCP token services (4 casts removed)"
    - "WS-01..05 traceability rows in REQUIREMENTS.md"
    - "5 backfilled VERIFICATION.md files (phases 20, 21, 22, 23, 24)"
    - "Final 27-VERIFICATION.md closing 12 D-* decisions"
  affects:
    - "v2.1-MILESTONE-AUDIT.md — flips from gaps_found to passed on next audit run"
tech_stack:
  added: []
  patterns:
    - "VERIFICATION.md backfill via promotion of embedded SUMMARY/UAT evidence"
    - "Mechanical doc-only closure pattern for shipped-without-tracking phases"
key_files:
  created:
    - ".planning/phases/20-read-crud-tools/20-VERIFICATION.md"
    - ".planning/phases/21-write-crud-tools/21-VERIFICATION.md"
    - ".planning/phases/22-ai-tools/22-VERIFICATION.md"
    - ".planning/phases/23-management-ui/23-VERIFICATION.md"
    - ".planning/phases/24-fathom-share-link-save/24-VERIFICATION.md"
    - ".planning/phases/27-close-v2-1-audit-gaps/27-VERIFICATION.md"
  modified:
    - "src/types/supabase.ts (regenerated)"
    - "src/services/mcp-tokens.service.ts (4 `as McpToken` casts removed)"
    - "src/services/mcp-token-capabilities.service.ts (1 `as McpToken` cast removed)"
    - ".planning/REQUIREMENTS.md (WS-01..05 + Coverage update)"
decisions:
  - "D-03: Regenerated supabase.ts; removed all 4 `as McpToken` casts (broader than the 2 the audit flagged — types now correct enough to drop the others too)"
  - "D-06: 5 VERIFICATION.md files backfilled with status reflecting source-evidence quality (not all 'verified' — Phase 20 backfilled-from-evidence, Phase 22 human_needed)"
  - "D-07: WS-01..05 added; Coverage recomputed at execute-time per plan-checker (21 → 26 active, 15 → 20 shipped)"
metrics:
  duration_minutes: ~30
  files_created: 7
  files_modified: 4
  commits: 8
  ts_errors_before: 0  # main pre-existing error count was already 0 for current build
  ts_errors_after: 0   # tsc clean after types regen + cast removal
  verification_md_before: 2  # 19, 25 (counting Phase 27 inclusion as new)
  verification_md_after: 8   # 19, 20, 21, 22, 23, 24, 25, 27
requirements:
  - "MGMT-02 (now type-safe via regenerated types)"
  - "WS-01"
  - "WS-02"
  - "WS-03"
  - "WS-04"
  - "WS-05"
---

# Phase 27 Plan 02: Wave 2 — Final Closure Summary

D-03 + D-06 + D-07 closed. supabase.ts regenerated cleanly with 4 schema additions; all 4 `as McpToken` casts removed; REQUIREMENTS.md gains 5 WS-XX traceability rows; 5 phase-level VERIFICATION.md files backfilled; final 27-VERIFICATION.md consolidates Wave 1 + Wave 2 evidence into a single closure document.

## What Shipped

**Type regeneration (D-03):** `supabase gen types typescript --linked` produced clean output (no CLI banner pollution). Generated types now include `mcp_tokens.enabled_categories: Json` (4 refs), `recordings.action_items_cache` (3), `recordings.coaching_cache` (3), `call_notes` table (3), and `regenerate_mcp_token` RPC return-shape with `enabled_categories: Json` (1). All 4 `as McpToken` casts removed across both service files — `npx tsc --noEmit` returned 0 errors total (broader cleanup than the 2 casts the audit flagged; the regenerated types were correct enough to drop the others without compilation errors).

**REQUIREMENTS.md update (D-07):** New `### Workspace Type Retirement (Phase 25)` section after the `PASTE-04` row, with 5 traceability rows (WS-01..05) marked `✅ Shipped` + pointer to `25-VERIFICATION.md`. WS-01..05 wording lifted verbatim from ROADMAP.md Phase 25 success criteria (7 criteria collapsed to 5 reqs per CONTEXT D-07). Coverage section recomputed at execute-time:

- v2.1 active reqs: 21 → **26** (+5 WS-XX)
- Shipped + verified: 15 → **20** (+5 WS-XX, all verified per 25-VERIFICATION.md)
- Real progress: 71% → **77%**

**5 VERIFICATION.md backfills (D-06):** Mechanical promotion of embedded evidence from each phase's SUMMARY/UAT into structured frontmatter. Status reflects source-evidence quality:

| Phase | Status | Source Evidence |
|-------|--------|-----------------|
| 20 | `backfilled-from-evidence` | 20-SUMMARY (preserves "Runtime not formally verified" caveat) |
| 21 | `verified` | 21-01-SUMMARY + 21-UAT (11/11 PASS for TOOL-05); TOOL-06/07 split as `partial (inventory-only)` |
| 22 | `human_needed` | 22-01..04-SUMMARY + 22-UAT (6/8 smoke-PASS + 2 manual pending — items 1, 7) |
| 23 | `verified` | 23-01-SUMMARY + 23-02-SUMMARY (7 live curl tests, all PASS in production) |
| 24 | `verified` | 24-01-SUMMARY (full prod e2e via dev-browser + 2 post-fix verifications) |

No phase status was promoted beyond what its source evidence supports (T-27-09 mitigation).

**27-VERIFICATION.md (final closure):** All 10 ROADMAP success criteria mapped — 9 ✅ verified, 1 ⏳ deferred (D-08, Nyquist VALIDATION). 12 D-* decisions closed. 9 threats T-27-01..09 mapped to evidence. Pre-existing `call_share_access_log` table gap surfaced and flagged for follow-up (out of Phase 27 scope).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Regen supabase.ts + remove `as McpToken` casts (D-03) | `1675f371` | `src/types/supabase.ts` (regen), `src/services/mcp-tokens.service.ts` (3 casts removed), `src/services/mcp-token-capabilities.service.ts` (1 cast removed) |
| 2 | Add WS-01..05 to REQUIREMENTS.md (D-07) | `6e720651` | `.planning/REQUIREMENTS.md` |
| 3 | Backfill 20-VERIFICATION.md (D-06) | `de7e3837` | `.planning/phases/20-read-crud-tools/20-VERIFICATION.md` |
| 4a | Backfill 21-VERIFICATION.md (D-06) | `eaa02a96` | `.planning/phases/21-write-crud-tools/21-VERIFICATION.md` |
| 4b | Backfill 22-VERIFICATION.md (D-06) | `7ff2282c` | `.planning/phases/22-ai-tools/22-VERIFICATION.md` |
| 4c | Backfill 23-VERIFICATION.md (D-06) | `cd9d7459` | `.planning/phases/23-management-ui/23-VERIFICATION.md` |
| 4d | Backfill 24-VERIFICATION.md (D-06) | `a1f33f15` | `.planning/phases/24-fathom-share-link-save/24-VERIFICATION.md` |
| 5 | Final 27-VERIFICATION.md | `ec604930` | `.planning/phases/27-close-v2-1-audit-gaps/27-VERIFICATION.md` |

**Total: 8 commits.**

## Coverage Math

**REQUIREMENTS.md before this plan:**
- 21 active reqs (PROV-01..03, TOOL-01..07, AITL-02..05 [01 dropped], MGMT-01..03, PASTE-01..04 = 3+7+4+3+4 = 21)
- 15 Shipped + verified
- WS-01..05 orphaned from traceability table despite 25-VERIFICATION.md showing 7/7 PASS

**REQUIREMENTS.md after this plan:**
- 26 active reqs (21 + WS-01..05)
- 20 Shipped + verified (15 + WS-01..05)
- Mapped to phases: 26
- Real progress: 20/26 = ~77% (was 15/21 = ~71%)

Numbers recomputed at execute-time per plan-checker concern; matched plan's "21 → 26" hardcoded value.

## TypeScript Errors (Plan-Touched vs Pre-Existing)

- **Before (pre-regen):** 0 errors total per `npx tsc --noEmit` on Wave 2 entry. Pre-existing 84 errors mentioned in CONTEXT.md `<deferred>` section appear to have been resolved independently before Wave 2.
- **After (post-regen + 4 cast removals):** 0 errors total — `TypeScript: No errors found`.
- **Plan-touched files (`mcp-tokens.service.ts`, `mcp-token-capabilities.service.ts`):** 0 errors after regeneration. Removing the `as McpToken` cast in `getMcpTokens` (line 56) and `createMcpToken` (line 110) — beyond the 2 the audit flagged — also compiled cleanly because the regenerated types now match the `McpToken` interface shape.

## 5 VERIFICATION.md Statuses

| Phase | Status | Notes |
|-------|--------|-------|
| 20 | `backfilled-from-evidence` | Honors 20-SUMMARY caveat: "Code-level: ✅. Runtime / dev-browser: ⏳ Not formally verified end-to-end via MCP client." All 4 TOOL-0X marked `partial (code-verified)`. |
| 21 | `verified` | TOOL-05 has 11/11 UAT PASS (live MCP client tests). TOOL-06/07 marked `partial (inventory-only)` — shipped pre-Phase-21 (commit ad73e50e), no UAT. |
| 22 | `human_needed` | 6/8 smoke-PASS in 22-UAT.md. Items 1 (live MCP client connect) and 7 (capability toggle round-trip) retain `human_needed` per source UAT. |
| 23 | `verified` | All 7 live curl tests in 23-02-SUMMARY PASS — backend round-trip closed in production. -32001 verified live for category-disabled tools. |
| 24 | `verified` | Full prod e2e via dev-browser + 2 post-fix verifications (33b3b9da + ce3b9c9e). All 4 PASTE-XX have comprehensive embedded evidence. |

## Deviations from Plan

### Branch state recovery (one-time, not a coding deviation)

Mid-plan, an external action checked out `main` and cherry-picked the uptime-monitor commit, leaving HEAD on `main` without Wave 1 + Wave 2 work. Rather than rewriting protected branch history (forbidden), I checked out back to `fix/phase-26-breakpoint-260507-kgl` where Wave 1 (9 commits) and Wave 2 Tasks 1+2 (`1675f371`, `6e720651`) were preserved. Untracked `20-VERIFICATION.md` survived the branch switch. No work lost.

### Auto-fixed Issues

**1. [Rule 1 — scope refinement] Removed all 4 `as McpToken` casts, not just the 2 audit-flagged**

- **Found during:** Task 1 (after running tsc and seeing the regenerated types matched the `McpToken` interface).
- **Issue:** Plan listed 2 casts to remove (`mcp-tokens.service.ts:147`, `mcp-token-capabilities.service.ts:50`). After removing those, `npx tsc --noEmit` was clean. Two additional casts existed in the same file (`getMcpTokens:56`, `createMcpToken:110`) that were now also removable cleanly.
- **Fix:** Removed all 4 casts. `tsc` remained clean.
- **Files modified:** `src/services/mcp-tokens.service.ts` (3 casts), `src/services/mcp-token-capabilities.service.ts` (1 cast).
- **Commit:** `1675f371`.

No other deviations. Plan executed exactly as written.

## Threat Coverage Table

| Threat | Status | Evidence |
|--------|--------|----------|
| T-27-08 (T) — supabase.ts banner pollution | mitigated | Wave 2 Task 1 — regen produced clean file; last meaningful line `} as const`; no trailing CLI banner; head/tail spot-checks pass |
| T-27-09 (I) — VERIFICATION.md frontmatter overstating verification | mitigated | Phase 20 status: `backfilled-from-evidence` (preserves Runtime not formally verified caveat); Phase 22 status: `human_needed` (preserves UAT items 1, 7 pending); Phase 21 splits TOOL-05 verified vs TOOL-06/07 partial. No claim is upgraded beyond evidence. |

## Self-Check

| Gate | Decision | Status | Evidence |
|------|----------|--------|----------|
| 7 | D-03 tsc clean for service files | PASS | `npx tsc --noEmit` returned `TypeScript: No errors found` after regen + 4-cast removal |
| 8 | D-07 REQUIREMENTS rows | PASS | `grep -c 'WS-0[1-5]' .planning/REQUIREMENTS.md` returned 15 (5 rows + 5 wording bullets + 5 surrounding refs); `### Workspace Type Retirement (Phase 25)` section header count = 1 |
| 9 | D-06 5 VERIFICATION.md exist | PASS | 5 files written with `source_evidence:` frontmatter; verified by `grep -l` count = 4 for phases 21-24, plus phase 20 verified separately |

**File verification (cat -e equivalent):**
- `src/types/supabase.ts` — regenerated, `} as const` on last meaningful line, 4749 lines
- `src/services/mcp-tokens.service.ts` — 0 `as McpToken` references
- `src/services/mcp-token-capabilities.service.ts` — 0 `as McpToken` references
- `.planning/REQUIREMENTS.md` — `### Workspace Type Retirement (Phase 25)` section + 5 WS-XX rows + footnote
- `.planning/phases/20-read-crud-tools/20-VERIFICATION.md` — status: backfilled-from-evidence
- `.planning/phases/21-write-crud-tools/21-VERIFICATION.md` — status: verified (TOOL-05) / partial (TOOL-06/07)
- `.planning/phases/22-ai-tools/22-VERIFICATION.md` — status: human_needed (items 1, 7)
- `.planning/phases/23-management-ui/23-VERIFICATION.md` — status: verified
- `.planning/phases/24-fathom-share-link-save/24-VERIFICATION.md` — status: verified
- `.planning/phases/27-close-v2-1-audit-gaps/27-VERIFICATION.md` — status: verified, 19 numbered table rows, 6 D-1[123] refs

**Commit verification:**
- `1675f371` (Task 1) — FOUND
- `6e720651` (Task 2) — FOUND
- `de7e3837` (Task 3) — FOUND
- `eaa02a96` (Task 4a) — FOUND
- `7ff2282c` (Task 4b) — FOUND
- `cd9d7459` (Task 4c) — FOUND
- `a1f33f15` (Task 4d) — FOUND
- `ec604930` (Task 5) — FOUND

## Self-Check: PASSED

## v2.1 Milestone Recommendation

All 6 v2.1-MILESTONE-AUDIT items addressed across Waves 1 + 2:

1. ✅ BLOCKER #1 (PROV-02 plan-gating disabled) — fixed (Wave 1 D-01)
2. ✅ BLOCKER #2 (supabase.ts missing 4 schema members) — fixed (Wave 2 D-03)
3. ✅ WARNING #1 (regenerate_mcp_token return shape) — fixed (Wave 1 D-04)
4. ✅ WARNING #2 (is_home/is_default drift) — fixed (Wave 1 D-05)
5. ✅ ORPHAN (WS-01..05 absent from REQUIREMENTS.md) — fixed (Wave 2 D-07)
6. ✅ VERIFICATION GAP (5 phases without VERIFICATION.md) — fixed (Wave 2 D-06)

Plus 3 Critical security findings closed in Wave 1 (D-11, D-12, D-13).

**Recommendation:** v2.1 milestone status flips from `gaps_found` to `passed` on next `/gsd-audit-milestone` run.

## Pre-Existing Gaps Surfaced (out-of-scope, flag for follow-up)

- **`call_share_access_log` table missing in production** (Wave 1 Gate 6 SQL spot-check). Pre-fix audit-log INSERT was already silently failing. Phase 27 fix closes the *forgery vector*, not the missing table. Recommend follow-up plan to add the table migration or remove the audit-log branch.
- **No live Zoom webhook in last 24h** — Gate 5 functional sign-off deferred to next live Zoom webhook event.

---

*Phase: 27-close-v2-1-audit-gaps*
*Plan: 02 (Wave 2)*
*Completed: 2026-05-07T20:15Z*
*Total Phase 27 commits (Wave 1 + Wave 2): 16*
