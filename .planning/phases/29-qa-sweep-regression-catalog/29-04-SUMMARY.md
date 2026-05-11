---
phase: 29-qa-sweep-regression-catalog
plan: 04
subsystem: qa-sweep
tags: [persona-c, dev-browser, share-link, wrong-account, regression-discovery, edge-function]

# Dependency graph
requires:
  - phase: "29-02"
    provides: "Share token vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59 (created by Persona A, addressed to na***@gmail.com)"
  - phase: "29-01"
    provides: "Dev-browser CLI environment validated for sweep automation"
provides:
  - "29-04-PERSONA-C-SWEEP-NOTES.md — structured Persona C observation log with 7 findings, all SHARE-01..04 tagged"
  - "8 PNG screenshots persona-c-*.png covering wrong-account view of /s/:token end-to-end"
  - "Verbatim wrong-account error text (and the backend response that drives it)"
  - "Backend prerequisite finding (Finding 03) — the Edge Function destroys the wrong-account signal, blocking the SHARE-02 frontend fix until the backend response shape changes"
affects:
  - "Plan 29-05 (catalog write-back) — consumes 29-04-PERSONA-C-SWEEP-NOTES.md as the primary source for SHARE-01..04 Sweep Status entries"
  - "Phase 32 (Share Flow hardening) — will consume the recipient-side visual baseline + the backend response-shape finding as implementation prerequisites"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dev-browser CLI heredoc scripts (same pattern as Plans 29-01 / 29-02 / 29-03)"
    - "Per-context auth state isolation via fresh dev-browser instance + localStorage/sessionStorage/cookie clearing at start AND end of sweep"
    - "Backend response capture via page.on('response') to distinguish backend-driven vs. frontend-driven failure shapes"

key-files:
  created:
    - .planning/phases/29-qa-sweep-regression-catalog/29-04-PERSONA-C-SWEEP-NOTES.md
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-00-starting-state.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-01-signed-out.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-02-signin-form-filled.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-03-signed-in.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-04-persona-c-home-view.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-05-share-link-opened.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-06-home-org-check.png
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-07-signed-out.png
  modified: []

key-decisions:
  - "Used CALLVAULTAI_LOGIN (a@vibeos.com) as Persona C because it IS distinct from the share recipient (na***@gmail.com) at the backend identity level — the orchestrator prompt's claim that Persona A's account equals the recipient was incorrect per .env contents. This produces a true wrong-account scenario (just not a wrong-USER scenario)"
  - "Captured the backend response shape (404 + CALL_NOT_FOUND for BOTH wrong-account and not-exist cases) as the headline finding — this is the SHARE-02 root cause that downstream Phase 32 must fix at the Edge Function before the frontend can render the desired message"
  - "Did NOT exercise the anonymous (signed-out) recipient flow per CONTEXT.md D-02 — that is Phase 32 / SHARE-01's full surface"

patterns-established:
  - "Wrong-account scenario coverage via Persona-C-as-different-CallVault-account (vs. cross-USER which requires a separate developer credential not available in v2.2)"
  - "Backend response capture pattern (page.on('response') with status >= 400 filter + secret redaction) — useful for any future sweep that needs to distinguish backend-driven from frontend-driven failures"

requirements-completed: [QA-01]

# Metrics
duration: 7min
completed: 2026-05-11
findings_total: 7
findings_by_tag:
  RE-VERIFY-SHARE: 3   # SHARE-01, SHARE-02, SHARE-03
  NO-REPRO-SHARE: 1    # SHARE-04 (route layer)
  NEW: 2               # Finding 03 backend signal, Finding 06 CSP merge
  INFORMATIONAL: 1     # Finding 07 cross-user leak not testable
findings_by_severity:
  P0: 3   # Findings 01, 02, 03
  P1: 1   # Finding 06 (CSP)
  P2: 1   # Finding 05 (SHARE-03 baseline)
  P3: 0
  informational: 2   # Findings 04, 07
screenshots_count: 8
share_token_consumed: "vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59"
---

# Phase 29 Plan 04: Persona C Wrong-Account Share Recipient Summary

**Confirmed SHARE-02 still broken via verbatim wrong-account error capture on production — Edge Function returns identical 404 + `CALL_NOT_FOUND` for "doesn't exist" and "wrong account", which means the Phase 32 frontend fix is blocked behind a backend response-shape change.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-11T22:43:00Z
- **Completed:** 2026-05-11T22:47:00Z (notes write + commit through 18:46-18:47 local)
- **Tasks:** 1
- **Files modified:** 9 (1 notes + 8 screenshots)

## Accomplishments

- Captured verbatim wrong-account error text on `/s/:token`: "Call Not Found / This share link is invalid or has expired. Please check the link or contact the person who shared it." with only a "Go Home" button — no logout, no sender, no recipient hint
- Captured the backend response (`/functions/v1/share-call?token=...` → 404 `{"error":"Shared call not found","code":"CALL_NOT_FOUND"}`) that drives the frontend message — proving SHARE-02 cannot be fixed in the frontend alone
- All four SHARE-NN requirements (SHARE-01..04) received a Sweep Status tag for Plan 29-05 to consume
- 8 screenshots covering signed-out start, sign-in, signed-in home, share-link wrong-account error, cross-account context check, clean sign-out

## Task Commits

1. **Task 1: Persona C wrong-account share-link sweep** — `3b6f7157` (feat)

## Files Created/Modified

- `.planning/phases/29-qa-sweep-regression-catalog/29-04-PERSONA-C-SWEEP-NOTES.md` — 21KB structured notes with 7 findings, Screen Trace table, SHARE-NN re-verification table, Threat Flags section, Summary
- `.planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-c-00..07-*.png` — 8 PNGs

## Decisions Made

1. **Persona C identity: used `a@vibeos.com` (CALLVAULTAI_LOGIN).** The orchestrator prompt predicted this would be a happy-path scenario, but `.env` shows CALLVAULTAI_LOGIN = `a@vibeos.com` while the share recipient = `na***@gmail.com`. These are distinct accounts at the backend identity level — signing in as `a@vibeos.com` and opening a share for `na***@gmail.com` IS the wrong-account scenario at the system level (just not a wrong-USER scenario, which would have required a second developer credential not available in v2.2). Documented this reasoning in the notes file's "Persona C identity note" and "Finding 07 (informational)" sections.

2. **Did NOT exercise anonymous recipient flow.** Per CONTEXT.md D-02, that is Phase 32 / SHARE-01's full surface. Notes file's Finding 02 covers SHARE-01 by inference (same component renders both branches based on the screen captured) and is explicitly tagged for Phase 32 to verify the anonymous branch directly.

3. **Headline finding routed to BACKEND, not frontend.** Finding 03 (`[NEW]`, P0) documents that the Edge Function is destroying the wrong-account signal. This is a SHARE-02 implementation prerequisite — Plan 29-05 should annotate the SHARE-02 requirement entry with this backend dependency so Phase 32 doesn't start with a "fix the frontend" framing.

## Deviations from Plan

### Deviation 1 — [Rule 3 — Approach] Persona C identity selection (orchestrator-prompt vs. .env reality)

- **Found during:** Step 0 (Persona C setup)
- **Issue:** Orchestrator prompt Option B said: "Use Persona A's session (which IS authed as naegele412 / the owner) — but that means Persona C and the recipient are the SAME account, which is the happy-path scenario, NOT the wrong-account scenario." This prediction was incorrect. The `.env` `CALLVAULTAI_LOGIN` is `a@vibeos.com`, not `naegele412@gmail.com`. The recipient on the share is `naegele412@gmail.com`.
- **Fix:** Used `a@vibeos.com` as Persona C, which IS the wrong-account scenario (Persona C != recipient). Documented this reasoning explicitly in the notes file's "Persona C identity note" section so Plan 05 and Phase 32 understand the coverage scope.
- **Files modified:** none — runtime decision documented in notes
- **Verification:** Notes file's Persona C identity note + Finding 07 cover this. The signed-in account email `a@vibeos.com` is recorded in the Pre-flight section.
- **Committed in:** 3b6f7157

### Deviation 2 — [Rule 2 — Backend disclosure] Routed Finding 03 as backend prerequisite

- **Found during:** Step 2 (verbatim error capture revealed identical 404 for both cases)
- **Issue:** REQUIREMENTS.md SHARE-02 implies a frontend-only fix ("show the masked recipient email + sign-out button"). The Edge Function destroys the wrong-account signal by returning identical responses for "not found" and "wrong recipient", so the frontend cannot render the desired message without backend changes.
- **Fix:** Documented as Finding 03 (`[NEW]`, P0) with explicit framing as a Phase 32 backend prerequisite. Recommended (with security caveats in the Threat Flags section) a response shape change to HTTP 403 + `{"error":"Wrong recipient","code":"WRONG_RECIPIENT","recipient_masked":"na***@gmail.com"}` gated to authenticated users.
- **Files modified:** none — documentation-only
- **Verification:** Finding 03 in notes file; Threat Flags section discusses the security trade-off of disclosing the masked recipient.
- **Committed in:** 3b6f7157

---

**Total deviations:** 2 (1 approach, 1 backend-routing for SHARE-02 implementation prerequisites)
**Impact on plan:** Both deviations IMPROVE the catalog quality. Deviation 1 produced a legitimate wrong-account capture under a constrained credential set. Deviation 2 surfaces a backend dependency that the SHARE-02 requirement entry should now reflect so Phase 32 plans correctly.

## Issues Encountered

- **Single developer credential constraint:** Only one CallVault developer login (`a@vibeos.com`) is in `.env`. True cross-USER wrong-account testing was not possible. Documented as Finding 07 (`[INFORMATIONAL]`) with recommendation for a Phase 32 or Phase 36 follow-up sweep if a P0/P1 finding ever indicates a cross-USER concern. Within-user, between-context isolation WAS verified (the persona-c context did not bleed from the prior persona-b context).
- **Default browser instance from Plan 02 had zero pages on probe** (Persona A's `qa-sweep` page lifecycle ended). Did NOT block this plan — created fresh `persona-c` named browser instance.

## SHARE-NN Re-Verification Summary (for Plan 29-05)

| Requirement | Status | Severity | Plan 29-05 routes to |
|-------------|--------|----------|----------------------|
| SHARE-01 | Confirmed (recipient-side `/s/:token` view is bare error; anonymous branch deferred to Phase 32 per D-02) | P0 | Phase 32 |
| SHARE-02 | Confirmed still broken; **backend Edge Function prerequisite** (Finding 03 documents the response-shape blocker) | P0 | Phase 32 — annotate SHARE-02 entry with backend dependency |
| SHARE-03 | Recipient-side visual baseline captured; sender-side captured in Plan 02 | P2 | Phase 32 (visual coherence with SHARE-02 fix) |
| SHARE-04 | Route layer NO-REPRO (renders cleanly); happy-path single-call render NOT verified (would need recipient credentials) | P1 | Phase 32 — verify happy path during SHARE-02 implementation |

## Verification done

| Acceptance criterion | Method | Verdict |
|----------------------|--------|---------|
| Notes file exists | `[ -f 29-04-PERSONA-C-SWEEP-NOTES.md ]` | PASS |
| Contains literal `SHARE-02` | `grep -c "SHARE-02"` → 18 | PASS |
| SHARE-01..04 tags ≥ 4 | `grep -cE "SHARE-0[1-4]"` → 36 | PASS |
| Contains masked `na***@gmail.com` | `grep -c 'na\*\*\*@gmail.com'` → 7 | PASS |
| ≥ 2 PNG screenshots persona-c-*.png | `ls persona-c-*.png \| wc -l` → 8 | PASS |
| Share token consumed in file | `grep -c "vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59"` → 10 | PASS |
| Wrong-account error text verbatim | `grep -c "Call Not Found"` → 7 | PASS |
| No Bearer tokens | `grep -E "Bearer [A-Za-z0-9._-]+"` → empty | PASS |
| No JWTs | `grep -E "eyJ[A-Za-z0-9._-]{20,}"` → empty | PASS |
| No password leaks | `grep -F "$PASSWORD"` → empty | PASS |
| Plain literal `naegele412@gmail.com` only in metadata | `grep -n "naegele412@gmail.com"` → line 8 (Pre-flight Share token consumed header per T-29-04-01) | PASS |
| D-02 anonymous flow NOT exercised | Notes file explicitly states this; no signed-out share-link navigation in screenshots | PASS |
| Final `## Summary` section in notes file | Present with bottom-line + counts | PASS |

## Authentication gates

None. The dev-browser sign-in completed without 2FA / CAPTCHA / OAuth challenges using stored `.env` credentials.

## Known Stubs

None introduced by this plan. Plan re-verifies existing stub-flavored gaps:

- **SHARE-01:** Public landing page does not exist (component renders bare error instead)
- **SHARE-02:** Wrong-account masked-recipient message does not exist (Edge Function destroys the discrimination signal — needs backend change)

Both are pre-existing v2.2 requirements; this plan provides recipient-side evidence + the backend-prerequisite finding (Finding 03) for Phase 32.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `supabase/functions/share-call` | Edge Function currently UNDER-discloses (good for security, bad for UX) — returns identical 404 for "doesn't exist" and "wrong recipient". The Phase 32 SHARE-02 fix likely needs to disclose the masked recipient email to drive the desired UX. Recommend: only disclose masked recipient when requester is an authenticated CallVault user (so the disclosure surface is gated to authenticated users, not anonymous). Document this as a SHARE-02 implementation note. |

## Self-Check: PASSED

- `[ -f 29-04-PERSONA-C-SWEEP-NOTES.md ]` → FOUND (21345 bytes)
- `grep -c "SHARE-02" 29-04-PERSONA-C-SWEEP-NOTES.md` → 18 (≥1 required)
- `grep -cE "SHARE-0[1-4]" 29-04-PERSONA-C-SWEEP-NOTES.md` → 36 (≥4 required)
- `ls persona-c-*.png | wc -l` → 8 (≥2 required)
- `grep -E "Bearer [A-Za-z0-9._-]+" 29-04-PERSONA-C-SWEEP-NOTES.md` → empty ✓
- `grep -E "eyJ[A-Za-z0-9._-]{20,}" 29-04-PERSONA-C-SWEEP-NOTES.md` → empty ✓
- `git log --oneline -1` shows commit `3b6f7157 feat(29-04): Persona C wrong-account share-link sweep ...` → FOUND
- D-02 deferred scope respected (no anonymous flow exercised) ✓

## Next Phase Readiness

- Plan 29-05 (catalog write-back) has all SHARE-01..04 Sweep Status data ready
- Phase 32 implementers have:
  - Verbatim current wrong-account error text + screenshot for visual baseline
  - Backend response evidence proving the SHARE-02 fix is a backend-first change (Finding 03)
  - Visual baseline of the bare error component to design the replacement against
- No production state was modified
- No new test accounts created during this sweep (one auth + one sign-out, no signup)

---
*Phase: 29-qa-sweep-regression-catalog*
*Completed: 2026-05-11*
