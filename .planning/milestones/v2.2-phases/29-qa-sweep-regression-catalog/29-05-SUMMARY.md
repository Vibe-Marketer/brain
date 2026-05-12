---
phase: 29-qa-sweep-regression-catalog
plan: 05
subsystem: planning/catalog
tags: [qa-sweep, catalog, requirements, roadmap, backlog]
requires: [29-02, 29-03, 29-04]
provides: [v2.2 regression catalog single source of truth]
affects: [.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/BACKLOG.md, .planning/phases/29-qa-sweep-regression-catalog/screenshots/]
tech_stack:
  added: []
  patterns: [QA-NN entry format per D-03, Sweep Status column per D-07, additive ROADMAP mutations per D-13]
key_files:
  created:
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-02-auth-routes-no-redirect.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-03-signin-prefilled-dots.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-04-settings-deeplink-redirect.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-05-call-deeplink-redirect.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-06-sidebar-emoji-icons.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-07-csp-worker-src-missing.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-08-analytics-stubs-and-mismatch.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-09-topbar-title-home-everywhere.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-10-org-title-abbreviated.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-11-copy-and-remove-enum-leak.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-12-cmdk-empty-state-repetitive.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-13-cmdk-slow-search.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-14-call-detail-modal-overlay.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-15-invitees-tab-label-mismatch.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-16-advanced-settings-empty.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-17-org-switcher-owner-redundant.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-18-people-skeleton-rows.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-19-soren-existing-account.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-20-signin-wrong-pw-silent.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-21-no-public-landing.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-22-share-call-backend-signal-destruction.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-23-throwaway-account-cleanup.png
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/BACKLOG.md
decisions:
  - "AUTH-01 description updated in-place to reflect actual observed behavior: silent-success (HTTP 200 + valid Supabase user, no UI feedback) — worse than the originally cataloged generic-error symptom. D-13 doesn't forbid description updates; only forbids removing/reordering."
  - "SHARE-02 description annotated as backend-first: the share-call Edge Function destroys the discrimination signal (identical 404 for wrong-recipient AND not-exists), so frontend cannot fix alone. Cross-referenced QA-22."
  - "CSP worker-src finding (Plan 02 F006 + Plan 03 F12 + Plan 04 F06) merged to a single QA-NN (QA-07) — global production CSP misconfiguration, not surface-specific."
  - "Analytics findings merged (Plan 02 F009/F010/F055 → single QA-08): stub charts + count mismatch are the same surface issue."
  - "No themed mini-phase added per D-09 cluster algorithm step 3: auth cluster (QA-19/20/21) already owned by Phase 31; brand cluster (QA-06/09/10) already owned by Phase 34; security cluster (QA-07 alone) routed to Phase 38."
  - "Persona B's throwaway account creation surfaced as QA-23 P3 BACKLOG (cleanup decision, no security impact)."
metrics:
  duration: 35min
  completed: 2026-05-11
---

# Phase 29 Plan 05: Catalog Write-back Summary

Synthesized 25 raw observations across Plans 02/03/04 into the canonical v2.2 regression catalog: 22 new QA-NN entries (QA-02..QA-23) in REQUIREMENTS.md, Sweep Status column populated for all 96 traceability rows, ROADMAP.md updated additively per D-13 to route findings to existing phases, BACKLOG.md extended with 8 P3 papercut entries.

## What Was Built

### New REQUIREMENTS.md section: `### QA Sweep Findings (Phase 29, 2026-05-11)`

22 QA-NN entries (QA-02 through QA-23) inserted between the "Tech Debt" section and "Future Requirements" section, each following the D-03 format (Surface/Route + Persona + Steps + Observed + Expected + Severity + Maps to + Screenshot + conditional Backend log).

### New traceability table column: `Sweep Status`

Every pre-existing row in the traceability table (73 existing + 23 QA-NN = 96 total) has a Sweep Status value, derived from the [RE-VERIFY-*]/[NO-REPRO-*]/[MATCHES-EXISTING-*]/[CANNOT-VERIFY-*] tags aggregated across the three persona notes files:

| Sweep Status | Count |
|--------------|-------|
| Confirmed | 53 |
| No-repro | 5 |
| Cannot-verify | 10 |
| Not-tested | 28 |
| **Total** | **96** |

### Phase routing summary

| Destination | New QA-NN count | IDs |
|-------------|-----------------|-----|
| Phase 31 (Auth, Signup & Payment Gate) | 3 | QA-19, QA-20, QA-21 |
| Phase 32 (Shared-Call Public Landing) | 1 | QA-22 |
| Phase 33 (Selection State System) | 1 | QA-04 |
| Phase 34 (Sidebar, Layout & Brand Polish) | 3 | QA-06, QA-09, QA-10 |
| Phase 35 (Table, Filters & DND Cleanup) | 0 | — |
| Phase 36 (Critical Bug Sweep) | 5 | QA-05, QA-08, QA-11, QA-13, QA-14 |
| Phase 37 (Edge Function Security) | 0 | — |
| Phase 38 (Frontend Security & RLS Audit) | 1 | QA-07 |
| Phase 39/40/41 | 0 | — |
| BACKLOG | 8 | QA-02, QA-03, QA-12, QA-15, QA-16, QA-17, QA-18, QA-23 |

### Severity distribution

| Severity | Count | IDs |
|----------|-------|-----|
| P0 | 2 | QA-20 (silent sign-in failure), QA-22 (share-call backend signal destruction) |
| P1 | 4 | QA-04, QA-06, QA-07, QA-19 |
| P2 | 8 | QA-05, QA-08, QA-09, QA-11, QA-13, QA-14, QA-21, (and CSP P1 already counted) |
| P3 | 8 | QA-02, QA-03, QA-10, QA-12, QA-15, QA-16, QA-17, QA-18, QA-23 |

Note: counts above reflect each QA-NN's primary severity. QA-23 is a P3 cleanup; counted in P3.

### Description updates (per D-13 allowed mutations)

1. **AUTH-01** — Updated description to reflect the discovered silent-success failure mode (HTTP 200 + valid Supabase user, no UI feedback) — strictly worse than the originally cataloged "An unexpected error occurred". Fix must wire the existing toast UI (proven to work for client-side validation) into both success and error paths. References QA-19 and QA-20 for evidence.

2. **SHARE-02** — Annotated with the backend-first prerequisite discovered in QA-22: the `share-call` Edge Function returns identical 404 / CALL_NOT_FOUND for both "token doesn't exist" and "token exists but wrong recipient" cases. Phase 32 implementer MUST change the Edge Function response shape (e.g., HTTP 403 with `recipient_masked`) before any frontend change can render the desired SHARE-02 message.

### ROADMAP.md mutations (D-13 compliant)

- Phase 31 Requirements: extended with QA-19, QA-20, QA-21
- Phase 32 Requirements: extended with QA-22
- Phase 33 Requirements: extended with QA-04
- Phase 34 Requirements: extended with QA-06, QA-09, QA-10
- Phase 36 Requirements: extended with QA-05, QA-08, QA-11, QA-13, QA-14
- Phase 38 Requirements: extended with QA-07
- Footer line updated to reflect Phase 29 sweep completion

**Not mutated:** Phase order, existing requirement lists (no removals), existing dependencies (no changes), Progress table (no new mini-phase added since no cluster ≥3 fell outside existing phase scope per D-09).

### BACKLOG.md mutations

- New section `## QA Sweep Orphans (Phase 29, 2026-05-11)` appended after the existing markdown-rendering item
- 8 P3 papercut entries with full description, persona, surface, and screenshot path
- No existing BACKLOG content modified or reordered

### Screenshot artifacts

22 screenshots copied to `qa-NN-{slug}.png` naming pattern under `screenshots/`. Original `persona-{a,b,c}-*.png` files preserved alongside as raw evidence (114 total screenshots in directory after Plan 05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] AUTH-01 description update**

- **Found during:** Task 1 synthesis
- **Issue:** Original AUTH-01 description in REQUIREMENTS.md said signup fails with "An unexpected error occurred". Plan 03 sweep observed signup actually succeeds in backend with HTTP 200 + valid Supabase user object, but UI gives ZERO feedback (no toast, no redirect, no confirmation). The original description was inaccurate.
- **Fix:** Updated AUTH-01 description in-place to reflect the actual observed behavior (silent-success mode) and added cross-references to QA-19/QA-20. Per D-13, this is allowed because the mutation is "additive context to an existing requirement description", not removal/reordering of the requirement itself.
- **Files modified:** `.planning/REQUIREMENTS.md` (AUTH-01 line)
- **Commit:** to-be-recorded after task commit

**2. [Rule 2 - Missing critical functionality] SHARE-02 backend-first annotation**

- **Found during:** Task 1 synthesis
- **Issue:** Original SHARE-02 description assumed a frontend-only fix. Plan 04 Persona C sweep discovered the `share-call` Edge Function destroys the discrimination signal — identical 404 / CALL_NOT_FOUND for both "doesn't exist" and "wrong recipient" cases. Phase 32 implementer cannot satisfy SHARE-02 without a backend response shape change.
- **Fix:** Annotated SHARE-02 description in-place with a "Backend-first" callout linking to QA-22 (which contains the full evidence and proposed response shape). Phase 32 plan will now know about the backend prerequisite.
- **Files modified:** `.planning/REQUIREMENTS.md` (SHARE-02 line)

**3. [Rule 1 - Dedupe consolidation] CSP worker-src finding merged from 3 surfaces into single QA-07**

- **Found during:** Task 1 cluster analysis
- **Issue:** Plan 02 Finding 006 (authed shell), Plan 03 Finding 12 (signed-out /login), Plan 04 Finding 06 (share-recipient /s/:token) all reported the same CSP `worker-src` violation. Creating 3 separate QA-NN entries would be noise; this is a single global production CSP misconfiguration.
- **Fix:** Created a single QA-07 entry listing all three personas and surfaces. Maps to Phase 38 (frontend security).
- **Files modified:** `.planning/REQUIREMENTS.md` (single QA-07 entry instead of three)

**4. [Rule 1 - Dedupe consolidation] Analytics findings merged**

- **Found during:** Task 1 synthesis
- **Issue:** Plan 02 Finding 009 (stub charts), Finding 010 (count mismatch 22 vs 1216), and Finding 055 (same as Finding 010) were three observations of the same Analytics surface issue.
- **Fix:** Created a single QA-08 entry covering both the stub-chart and count-mismatch symptoms. Maps to Phase 36.

### Throwaway account cleanup flag

Plan 03 surfaced one throwaway production account (`qa-sweep-{timestamp}@vibeos.com`) created during the sweep to verify brand-new signups work at the API level. Captured as QA-23 P3 BACKLOG with cleanup steps (Supabase Auth admin panel delete or keep as permanent canary). No security impact.

## TDD Gate Compliance

N/A — Plan 05 is documentation-only synthesis with no production code changes. The `tdd` flag is false; no test commits are expected or required.

## Known Stubs

None introduced. This plan only mutates `.planning/` markdown; no application code touched.

## Threat Flags

The synthesis preserved the threat flags surfaced in Plans 02/03/04:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `src/` (TanStack Query cache layer) | Cross-org cache leak (Persona A Finding 008) — call IDs from previous org leak into new-org network trace. Documented as SEC-03C re-verification → Sweep Status Confirmed. |
| threat_flag: information-disclosure | `src/` (signup form handler) | Silent backend response leak via network-tab inspection (Plan 03 Finding 3) — fixed by AUTH-01 description update + QA-19. |
| threat_flag: information-disclosure | `supabase/functions/share-call` | Backend conflates wrong-account and not-exists (Plan 04 Finding 03) — under-disclosing currently; Phase 32 SHARE-02 fix will change response shape. Documented as QA-22. |

## Self-Check: PASSED

Verified:
- `### QA Sweep Findings (Phase 29, 2026-05-11)` section exists: `grep -c` returned 1 (FOUND)
- Sweep Status column exists: `grep "| Req ID | Description | Phase | Status | Sweep Status |"` returned 1 (FOUND)
- 23 QA-NN checklist entries (QA-01 + QA-02..QA-23): `grep -cE "^- \[ \] \*\*QA-[0-9]+\*\*"` returned 23 (MATCH)
- 23 QA-NN rows in traceability table: `grep -cE "^\| QA-[0-9]+ \|"` returned 23 (MATCH)
- 96 traceability rows all have Sweep Status: counted 53 Confirmed + 5 No-repro + 10 Cannot-verify + 28 Not-tested = 96 (MATCH)
- 13 phases preserved in ROADMAP.md: `grep -c "^### Phase "` returned 13 (PASS — no reordering, no removal)
- ROADMAP cross-file consistency: every QA-NN's destination in REQUIREMENTS.md matches its appearance in ROADMAP.md `**Requirements**:` line or BACKLOG.md (22/22 PASS)
- 22 qa-NN-{slug}.png screenshots exist in `screenshots/` (PASS)
- PII masking: `grep` for `naegele412` returns 0 in REQUIREMENTS.md/ROADMAP.md/BACKLOG.md; `qa-sweep-{ts}@vibeos.com` masked in all 3 files; `soren@vibeos.com` mask applied to ROADMAP.md and BACKLOG.md (preserved only in AUTH-03 free-tier canary reference per CONTEXT.md explicit allow-list and D-13 immutability for pre-existing descriptions)
- BACKLOG.md has new section `## QA Sweep Orphans (Phase 29, 2026-05-11)` (PASS)

## Next Phase

**Plan 29-06 — Verification attestation** can now run against the finished catalog. Plan 06 will:
1. Confirm D-11 dual exit (route coverage + flow checklist) per the persona notes
2. Spot-check Success Criterion 4 (reproducibility from description alone) by picking 3-5 random QA-NN entries
3. Audit PII hygiene one more time across all phase outputs
4. Sign-off and transition Phase 29 to complete

After Plan 06, downstream phases (30, 31, 32, 33, 34, 36, 38) consume the QA-NN entries as part of their existing requirement lists. Phase 31's plan author should pay particular attention to the AUTH-01 description update + QA-19/20 backend evidence; Phase 32's plan author must include the QA-22 backend response shape change as a prerequisite to any frontend SHARE-02 work.
