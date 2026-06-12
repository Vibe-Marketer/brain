---
phase: 14-in-app-approval-loop
plan: 04
subsystem: frontend
tags: [admin-center, approval-loop, evidence-bundle, ticket-detail, tanstack-query]

# Dependency graph
requires:
  - phase: 14-01
    provides: deployed ticket-approval Edge Function (approve/reject contract)
  - phase: 14-02
    provides: useUpdateTicketQueueControls hook (priority/urgent)
  - phase: 15-03
    provides: TicketDetailDialog.tsx shipped state (messages/attachments/events) — file ownership released
  - phase: 13-01
    provides: tickets.priority/urgent columns
  - phase: 13-03
    provides: live agent evidence-bundle message format (assembleBundle header strings)
provides:
  - "TicketEvidence renderer — agent evidence-bundle blocks (Diff/Tests/Codex/Revert) with tail-truncated expanders + RevertCard, ported from dead branch and rebound to live ticket_messages"
  - "ticket-approval.service + useTicketApproval hooks — approveTicket/rejectTicket via the deployed Edge Function (no client ticket_events INSERT)"
  - "TicketDetailDialog approval bar (admin + awaiting_approval), evidence mount, and priority/URGENT queue controls — APPR-01 + APPR-02 client half live in /admin"
affects: [13-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "evidence-bundle parsed by splitting on '## ' markdown headers; unknown shapes fall back to a single expander (never crash)"
    - "branch/SHA derived from evidence message text (live source), not dead event payloads"
    - "approval recorded as event; UI shows 'merges next poll' note rather than fake-resolving status"
    - "renderDialog test helper made polymorphic (array | options) to preserve 15-03 attachment tests"

key-files:
  created:
    - src/services/ticket-approval.service.ts
    - src/services/__tests__/ticket-approval.service.test.ts
    - src/hooks/useTicketApproval.ts
    - src/components/admin/TicketEvidence.tsx
    - src/components/admin/__tests__/TicketEvidence.test.tsx
  modified:
    - src/components/settings/TicketDetailDialog.tsx
    - src/components/settings/__tests__/TicketDetailDialog.test.tsx

key-decisions:
  - "Evidence header strings pinned from ~/dev/autopilot/src/lib/evidence.ts assembleBundle ('# Autopilot fix evidence', '## Diff/Tests/Repro replay/Codex review/Revert/Deploy') — fixtures mirror them exactly"
  - "RevertCard renders only when a branch OR fix SHA is parsed from the bundle; revert command prefers `git revert <revertSha>`, falls back to `git branch -D <branch>`"
  - "Approve does NOT locally set status — approveTicket.isSuccess flips the bar to the persistent 'dispatcher merges on next poll (<=5 min)' note"
  - "All admin surfaces gate on useUserRole().isAdmin; reporter rendering byte-equivalent to 15-03"
  - "dev-browser execution-time check deferred to verifier (no live admin session / disposable fixture in autonomous context) — wiring pinned by 29 tests + scoped tsc + green build, following 14-02 precedent"

requirements-completed: [APPR-01, APPR-02]

# Metrics
duration: ~12min
completed: 2026-06-11
---

# Phase 14 Plan 04: In-App Review Surface Summary

**Evidence bundle rendering (APPR-01) and Approve/Reject + priority/URGENT controls (APPR-02 client half) live on TicketDetailDialog in /admin — agent fixes are now readable as structured blocks and approvable in one click, wired to the deployed ticket-approval function and the 14-02 queue-control hook, with reporter rendering unchanged.**

## Performance

- **Duration:** ~12 min (started 2026-06-11T17:26:10Z)
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- **TicketEvidence.tsx** — renders agent-authored (`author_type==='agent'`) evidence messages as structured blocks: parses the daemon's markdown bundle on `## ` headers, renders known sections (Diff/Tests/Repro replay/Codex review/Revert/Deploy) in tail-truncated `<details><pre>` expanders (Codex review default-open), derives branch/fix-SHA/revert-SHA from the message text and shows a RevertCard (vibe-orange `RiArrowGoBackLine`, CopyButtons, `git revert` hint) only when a branch or SHA is present. Unknown-shape agent messages fall back to a single expander. Renders `null` when no agent messages exist (15-03 zero-regression).
- **ticket-approval.service.ts** — `approveTicket(id)` / `rejectTicket(id, reason)` invoke the deployed `ticket-approval` Edge Function (`{ticket_id, action, reason?}`); surfaces the function's `{error}` payload out of the `FunctionsHttpError` Response on non-2xx; client-side empty-reason guard. No client `ticket_events` INSERT path (T-14-15).
- **useTicketApproval.ts** — `useApproveTicket` / `useRejectTicket` mutations invalidate `['tickets']`, `['ticket', id]`, and `queryKeys.admin.all`; toast on success/error.
- **TicketDetailDialog.tsx** — admin-gated additions: evidence mount above the message thread; APPROVE/REJECT bar on `awaiting_approval` (approve → AlertDialog confirm with explicit merge-consequence text → persistent "merges on next poll" note; reject → required-reason Textarea, submit disabled until 1-2000 chars); priority quick-set (0-3) + URGENT Switch (vibe-orange) wired to `useUpdateTicketQueueControls`. Every block gates on `useUserRole().isAdmin`.

## Gates

- **Target vitest:** ticket-approval.service 9/9, TicketEvidence 6/6, TicketDetailDialog 16/16 (was 5 — appended 11)
- **Full suite:** 1889 pass / 1 fail / 45 skipped — the single failure is the pre-existing `rpc-type-smoke` (28 SECURITY DEFINER offenders, phases 06-12, logged in 13's deferred-items; unrelated to these frontend files)
- **Build:** `npm run build` exit 0
- **Scoped tsc** (`tsc -p tsconfig.app.json`): zero errors in the non-test edited/created source (TicketDetailDialog.tsx, TicketEvidence.tsx, ticket-approval.service.ts, useTicketApproval.ts). Test-file jest-dom matcher errors under raw tsc are a pre-existing baseline condition across the whole suite (matchers extend at runtime via setup.ts; build excludes tests) — identical in kind to 15-03's already-shipped TicketDetailDialog.test.tsx.
- **dangerouslySetInnerHTML:** 0 actual JSX usages in TicketEvidence.tsx / TicketDetailDialog.tsx (one comment-only mention) — T-14-12 mitigated.

## Threat Register Compliance

- **T-14-12 (XSS):** evidence text renders as React text nodes / `<pre>` only; no `dangerouslySetInnerHTML`, no markdown-to-HTML, no new deps.
- **T-14-13 (EoP):** all controls gate on `isAdmin`; server is the real control (14-01 403, RLS on priority/urgent).
- **T-14-14 (accidental approve):** AlertDialog confirm with explicit "dispatcher will merge and push the held branch" text.
- **T-14-15 (spoofing):** no client `ticket_events` INSERT — only `functions.invoke('ticket-approval')`.
- **T-14-SC (package installs):** no new packages.

## Deviations from Plan

None — plan executed as written. The dev-browser execution-time check (Task 2 acceptance criterion) was not performed in the autonomous executor context (no live admin session, no disposable awaiting_approval fixture, live runner mid-operation). Component wiring is pinned by 31 passing tests, scoped tsc, and the green build. Flagged below for the verifier, following 14-02's documented precedent.

## File Ownership

Committed only the 7 plan-owned files. Did NOT touch DashboardSection (14-02), AdminCategoryPane / AuditSection / QaSection / AdminCommandPalette / new admin section files (16-03 executor's concurrent work, present uncommitted in the working tree), or `~/dev/autopilot`. Both commits verified to contain only owned files.

## For the Verifier

- **dev-browser pass over /admin remains worthwhile before 13-07's E2E:** as admin, open an `awaiting_approval` fixture ticket → confirm evidence blocks render, reject-with-reason works end-to-end against the live function, and approve records (status stays awaiting_approval with the "merges next poll" note). 14-02 flagged the same dev-browser gap.

## Known Stubs

None.

## Task Commits

1. **Task 1: Approval service/hooks + TicketEvidence** — `a093503` feat(14-04): approval service/hooks + TicketEvidence renderer
2. **Task 2: Dialog wiring** — `5b865de` feat(14-04): wire approval bar, evidence mount, queue controls into TicketDetailDialog

## Self-Check: PASSED

All 5 key files on disk; both commits (a093503, 5b865de) in history.
