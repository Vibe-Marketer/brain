---
phase: 11-org-segregation-4-pane
plan: "04"
subsystem: layout
tags: [4-pane, modal, call-detail, analytics, appshell]
dependency_graph:
  requires: [11-02]
  provides: [modal-routing-for-call-detail, analytics-appshell, modal-vs-pane4-rules]
  affects: [CallDetailPage, TranscriptsTab, AppShell, Analytics]
tech_stack:
  added: []
  patterns: [redirect-to-modal, url-deep-link, appshell-wrapper]
key_files:
  created: []
  modified:
    - src/pages/CallDetailPage.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - src/components/layout/AppShell.tsx
decisions:
  - "CallDetailPage replaced with thin redirect to /?callId=<id> — all deep-link URLs preserved via TranscriptsTab URL param handler"
  - "TranscriptsTab deep-link effect matches by recording_id (integer) or canonical_uuid to support all URL formats"
  - "Modal vs Pane 4 rules documented as JSDoc comment in AppShell.tsx for discoverable in-code reference"
metrics:
  duration: "22s"
  completed_date: "2026-03-30T21:06:46Z"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 3
---

# Phase 11 Plan 04: Audit 4-Pane Hierarchy Compliance Summary

**One-liner:** Call detail modal routing via URL redirect pattern; Analytics already AppShell-compliant; Modal vs Pane 4 rules documented in AppShell.tsx.

## What Was Built

### Task 1: Fix CallDetailPage to modal pattern + Analytics audit + AppShell rules (COMPLETE)

**CallDetailPage.tsx** — Replaced 522-line standalone page with a 33-line redirect component. Per Phase 11 Decision D-07, call detail must open as a modal overlay (CallDetailDialog), not a standalone page. The new component:
- Extracts `callId` from `useParams()`
- Navigates to `/?callId=<id>` immediately on mount
- Falls back to `/` if no callId

**TranscriptsTab.tsx** — Added deep-link `useEffect` that:
- Reads `callId` from URL search params after `validCalls` data loads
- Matches by `recording_id` (integer legacy IDs) or `canonical_uuid` (UUIDs)
- Opens `CallDetailDialog` via `setDetailCall(match)`
- Removes `callId` param from URL after opening to keep URL clean

This ensures all existing bookmarked `/call/:id` links continue to work — they just redirect to the Calls page and open the modal.

**Analytics.tsx** — Verified already uses `AppShell` wrapper with proper secondary pane (`AnalyticsCategoryPane`). No changes required.

**AppShell.tsx** — Added JSDoc comment block documenting the Modal vs Pane 4 rules from decisions D-08, D-09, D-10, placed before imports for maximum discoverability.

### Task 2: Visual verification (CHECKPOINT — awaiting human verification)

This is a `checkpoint:human-verify` task. The dev server needs to be started and the user needs to visually confirm:
- Import page 4-pane layout (from Plan 11-02)
- Org switch state reset with fade transition (from Plan 11-01)
- Call detail opens as modal (this plan)
- Analytics uses consistent sidebar layout (this plan)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 4d72a029 | feat(11-04): convert CallDetailPage to modal redirect + document Modal vs Pane 4 rules |

## Deviations from Plan

None — plan executed exactly as written. Analytics.tsx was already AppShell-compliant, so no changes were needed (as the plan anticipated via its fallback condition).

## Verification

- `npx tsc --noEmit` — PASSED, no TypeScript errors
- `grep -n "navigate\|callId" src/pages/CallDetailPage.tsx` — PASSED, redirect logic present
- `grep -n "AppShell" src/pages/Analytics.tsx` — PASSED, AppShell in use
- `grep -c "Modal vs Pane 4" src/components/layout/AppShell.tsx` — PASSED, returns 1

## Known Stubs

None — all changes are functional with no placeholder data.

## Self-Check: PASSED

- src/pages/CallDetailPage.tsx: FOUND
- src/components/transcripts/TranscriptsTab.tsx: FOUND (deep-link effect added)
- src/components/layout/AppShell.tsx: FOUND (Modal vs Pane 4 comment added)
- Commit 4d72a029: FOUND
