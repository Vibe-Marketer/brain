---
phase: 29
plan: 02
subsystem: qa-sweep
tags: [persona-a, dev-browser, 3-org-cycle, regression-discovery]
requires:
  - "29-01 (precheck PASS, dev-browser session valid for Persona A)"
provides:
  - "29-02-PERSONA-A-SWEEP-NOTES.md — 1098-line raw observation log with 58 findings, all tagged for Plan 29-05 catalog write-back"
  - "88 PNG screenshots under screenshots/persona-a-*.png covering every route + every D-11 flow + 3-org cycle"
  - "Share token vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59 for Plan 29-04 (Persona C wrong-account)"
affects:
  - Plan 29-04 (Persona C wrong-account share recipient) — consumes the share token recorded in the Cleanup List section
  - Plan 29-05 (catalog write-back) — reads 29-02-PERSONA-A-SWEEP-NOTES.md as the primary source for QA-NN entries and Sweep Status column values
tech_stack:
  added: []
  patterns:
    - "dev-browser Playwright skill driven by `npx tsx` heredoc scripts (same pattern as Plan 29-01)"
    - "Persistent browser profile maintained Persona A's authenticated session across all sweep activity — no re-auth needed"
    - "AISnapshot (`client.getAISnapshot`) + `selectSnapshotRef` for ref-based clicking when CSS selectors were ambiguous"
key_files:
  created:
    - .planning/phases/29-qa-sweep-regression-catalog/29-02-PERSONA-A-SWEEP-NOTES.md
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-a-*.png (88 files)
  modified: []
decisions:
  - "Single combined commit for Plan 29-02 (instead of one commit per task) — the two tasks executed in the same session with the same context; splitting into two commits would have artificially bisected the findings"
  - "[CANNOT-VERIFY-*] tag introduced for findings that need user visual judgment at small font size (BRAND-03 italic detection, BRAND-06 contrast judgment, TABLE-03 alignment subjective)"
  - "DND mutation (drag-to-folder) skipped per read-only intent — handle visibility verified but mutation deferred to a downstream phase that can revert"
  - "Tag mutation skipped because the BUG-01 surface (Tag with AI button) is not exposed in the UI — recorded as Finding 016"
metrics:
  duration_minutes: 39
  completed_date: 2026-05-11
  routes_visited: 12
  orgs_cycled: 3
  findings_total: 58
  findings_by_severity:
    P0: 3
    P1: 11
    P2: 24
    P3: 20
  findings_by_tag:
    NEW: 16
    RE-VERIFY: 28
    NO-REPRO: 5
    CANNOT-VERIFY: 9
    SECURITY-P0: 1
  screenshots_count: 88
  test_mutations: 2  # workspace create+delete, default-workspace toggle+revert
  test_mutations_reverted: 2
---

# Phase 29 Plan 02: Persona A Sweep Summary

One-line: Cycled Persona A (owner) across all 3 production orgs (AI Simple / Business / GoVibey) on app.callvaultai.com via dev-browser Playwright skill, captured 58 findings in a structured raw notes file (1098 lines, 88 screenshots) — confirmed BUG-01 + SEC-03C P0 surfaces, with BUG-02 / BUG-06 / BUG-08 / SHARE-03 now appearing No-repro.

## What got built

A raw observation file (`29-02-PERSONA-A-SWEEP-NOTES.md`, 1098 lines) and 88 PNG screenshots covering every authenticated route in `src/App.tsx`, every unauth route, every legacy redirect, and every Persona A item on the D-11 primary user flow checklist. Each observation is tagged for Plan 29-05's catalog write-back routing (`[NEW]`, `[RE-VERIFY-{ID}]`, `[NO-REPRO-{ID}]`, `[CANNOT-VERIFY-{ID}]`, `[MATCHES-EXISTING-{ID}]`) and severity-rated P0/P1/P2/P3 per CONTEXT.md D-10.

The notes file has:
- Coverage Matrix: every route ✓ in every org (or n/a with reason)
- 58 Finding blocks in the format defined by interfaces (Tag / Surface / Persona / Org / Steps / Observed / Expected / Severity / Maps-to / Screenshot / Backend log conditional)
- Re-verification Summary section: maps every existing requirement (BUG-01..09, VIS-01..05, BRAND-01..10, TABLE-01..03, FILTER-01..04, DND-01..02, CARD-01..02, SHARE-03..04) to its Sweep Status value for Plan 29-05
- Cleanup List + Cleanup List for Plan 04 sections (share token handoff)
- Threat Flags section recording the SEC-03C cache-leak surface

## Verification done

| Acceptance criterion | Method | Verdict |
|----------------------|--------|---------|
| Notes file exists with ≥100 lines | `wc -l` → 1098 | PASS |
| Contains literal "Persona A" | `grep -c` → 11 | PASS |
| ≥1 entry per route in src/App.tsx | Coverage Matrix complete; routes either ✓ or `n/a (reason)` | PASS |
| ≥1 entry per primary user flow (D-11 F1-F14) | "Re-verification Notes" section + Findings tagged per flow | PASS |
| ≥1 re-verification entry per BUG-01..09 | `grep -cE "BUG-0[1-9]"` → 67 | PASS |
| Each finding tagged | 61 tag occurrences across NEW / RE-VERIFY / NO-REPRO / CANNOT-VERIFY | PASS |
| Each [NEW] has P0-P3 severity | All NEW findings carry explicit severity label | PASS |
| Cleanup List for Plan 04 with share token | Section present with token `vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59` | PASS |
| ≥16 PNGs per primary user flow | 88 PNG files matched by `persona-a-*.png` | PASS |
| BUG re-verify count ≥9 | 67 (well over) | PASS |
| Tag count ≥20 | 61 | PASS |

## Top findings (impact-ordered)

### P0 / security-critical
1. **Finding 007 — BUG-01 chain confirmed:** `call_speakers?recording_id=in.(144012376,143800259,...)` HTTP 400 because Fathom numeric IDs pass where UUIDs required. Direct root-cause evidence. Maps to Phase 30 (BUG-01).
2. **Finding 008 — SEC-03C cross-org cache leak P0:** Switched AI Simple → Business; network trace AFTER the switch still queries AI Simple call IDs (144012376 etc.). TanStack Query cache not invalidated on org switch. Maps to Phase 38 (SEC-03C).
3. **Finding 015 — BUG-01 chain extends to Business + GoVibey:** Both other orgs also have Fathom numeric IDs on some calls. Org-wide problem.

### P1 / broken-feature
- **Finding 005:** Sidebar uses emoji icons (`📞 👥 🏢 📥 🔀`) instead of Remix Icons — **HARD CONSTRAINT VIOLATION** per CLAUDE.md.
- **Finding 006:** CSP blocks blob: workers (`script-src` missing `worker-src 'self' blob:`). Workers silently fail; feature broken.
- **Finding 016:** "Tag with AI" button not exposed in UI — BUG-01's primary symptom inaccessible.
- **Finding 019:** No transcript paste UI on /import (BUG-05).
- **Finding 021:** Import "+" button does nothing (BUG-07).
- **Finding 003:** `/settings/ai-integrations` and `/settings/admin` deep-link URLs redirect to `/settings/account`.
- **Finding 018:** Date column header click doesn't toggle sort direction (BUG-04 partial).
- **Finding 039:** Folders column blank for most calls (BUG-01 chain → TABLE-02).
- **Finding 043:** FILTER-03 cannot-verify; click selector ambiguous (Plan 29-05 / Phase 35 should re-run).

### P2 / UX papercut (visual polish, alignment, ordering)
24 findings across BRAND-01..05, BRAND-08, BRAND-10, VIS-01..05, TABLE-01..02, FILTER-01..02, FILTER-04, CARD-01, BUG-09 (a11y warnings), Finding 010 (Analytics 22 vs Home 1216 inconsistency), Finding 011 (top-bar central title doesn't update), Finding 013 (Cross-Organization Default: "Copy And_remove" placeholder leak), Finding 053 (Call Detail modal overlay contradicts architecture rule), and others.

### No-repro candidates (per D-08 these do NOT auto-close)
- **BUG-02** (Finding 017): Workspace default-toggle worked, zero 406 errors.
- **BUG-06** (Finding 020): Import History button navigates correctly (empty data state, may still be a separate stub finding).
- **BUG-08** (Finding 022): New workspace created NO auto-folders (Hall of Fame / Manager Reviews absent).
- **SHARE-03** (Finding 049): Share Call modal visually clean.
- **BRAND-07** (Finding text): No doubled X close buttons across the modals inspected.

## Deviations from Plan

### Auto-fixed adjustments (Rule 3 — Blockers)

**1. [Rule 3 — Blocker] dev-browser server not running at sweep start**
- **Found during:** Task 1 setup
- **Issue:** Plan 29-01 ran the dev-browser server but the local server process didn't persist to this session.
- **Fix:** Ran `./server.sh &` from `~/.claude/plugins/marketplaces/dev-browser-marketplace/skills/dev-browser/` — server detected port 9222 already had a process. Verified via test `npx tsx` that the persistent profile still held Persona A's session.
- **Files modified:** none (just a process management step)
- **Documented in:** This SUMMARY; sweep notes top header

**2. [Rule 3 — Blocker] tr-click on call rows didn't open call detail**
- **Found during:** Task 2 Flow F5
- **Issue:** First attempt to open a call row via Playwright `<tr>` click did nothing — the row title is rendered as a `<button class="text-left hover:underline ...">` inside the row, not a row-level click handler.
- **Fix:** Targeted the button directly via DOM scan finding elements with `textContent === "Q3 Sales Sync"`, then mouse-clicked the button's bounding rect coordinates.
- **Files modified:** none
- **Documented in:** Sweep notes Finding 053 (modal-vs-pane architecture note); Finding 047 (CARD-01 chevron-only click)

**3. [Rule 3 — Optimization] Default-workspace toggle was disabled on current default**
- **Found during:** Task 2 Flow F9 (BUG-02 re-verify)
- **Issue:** When opening Pane 4 for "My Calls" (the current default workspace), the toggle was `disabled` — you can't toggle the current default OFF directly because the UI requires another workspace to be set as default first.
- **Fix:** Opened "AI Simple Founders" (non-default) detail pane instead, toggled it ON to default — this gave us the real BUG-02 surface (toggling default-workspace SHOULD work and worked cleanly here, hence NO-REPRO). Then opened "My Calls" detail again to revert it back to default.
- **Files modified:** none (test mutations reverted)
- **Documented in:** Sweep notes Finding 017

**4. [Rule 3 — Calibration] Synthetic `evaluate(() => btn.click())` didn't trigger Radix tabs**
- **Found during:** Task 1 (call detail tabs walk)
- **Issue:** First attempt to switch call detail tabs via `page.evaluate(() => tab.click())` returned `aria-selected="true"` still on "Overview" — Radix tabs require real DOM-level events, not synthetic clicks.
- **Fix:** Switched to Playwright `page.locator(...).click()` which uses real event dispatch. Tabs switched correctly afterward.
- **Files modified:** none
- **Documented in:** Sweep notes Finding 027

No bugs were INTRODUCED by this plan — the sweep is observation-only per D-13. All test mutations (workspace create+delete, default-workspace toggle+revert) were reverted before plan completion.

## Authentication gates

None. Persona A's persistent dev-browser session remained valid throughout the sweep — no fresh login needed. Mentioned in halt_conditions but did not trigger.

## Known Stubs

Documented in the notes file as Findings (not separately catalogued because these are observations to feed into Plan 29-05):

- **Finding 009:** Analytics page shows "Line chart coming soon" / "Bar chart coming soon" — visible stub charts.
- **Finding 011:** Top-bar central title says "HOME" on every page (doesn't update).
- **Finding 020:** Import History page has empty content (could be stub OR genuinely empty data — needs Phase 36 to disambiguate).
- **Finding 056:** Pane 4 Workspace Detail shows "ADVANCED SETTINGS" label with no content underneath (truncated or stub).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `src/` (TanStack Query cache layer) | Cross-org cache leak (Finding 008): AI Simple call IDs leak into Business org's network trace after org switch. SEC-03C already scoped in Phase 38; Finding 008 is direct re-verification confirmation. |

## Self-Check: PASSED

- `[ -f .planning/phases/29-qa-sweep-regression-catalog/29-02-PERSONA-A-SWEEP-NOTES.md ]` → FOUND (1098 lines)
- `[ -f .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-a-001-session-check.png ]` → FOUND
- `[ -f .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-a-113-share-link-created.png ]` → FOUND (share token evidence)
- `grep "Persona A" 29-02-PERSONA-A-SWEEP-NOTES.md` → 11 occurrences (≥1 required)
- `grep "naegele412@gmail.com" 29-02-PERSONA-A-SWEEP-NOTES.md` → 7 occurrences (≥1 required)
- `grep "vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59" 29-02-PERSONA-A-SWEEP-NOTES.md` → present (share token recorded for Plan 04)
- `grep -E "BUG-0[1-9]" 29-02-PERSONA-A-SWEEP-NOTES.md | wc -l` → 67 (≥9 required)
- `grep -E "SHARE-0[1-4]" 29-02-PERSONA-A-SWEEP-NOTES.md | wc -l` → 16 (≥1 required)
- `grep -cE "^### Finding [0-9]" 29-02-PERSONA-A-SWEEP-NOTES.md` → 58 (≥1 required)
- `ls screenshots/persona-a-*.png | wc -l` → 88 (≥15 required)
- `git log --oneline -1` shows commit `6e290764 feat(29-02): Persona A QA sweep ...` → FOUND
- Cleanup List `[x]` items → 5 (≥1 required; all test mutations reverted)
- No `Bearer ...` or `eyJ.eyJ...` JWT strings in notes file → CONFIRMED (no token leaks)
