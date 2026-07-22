---
status: complete
phase: quick-260721-x8o
plan: 01
subsystem: frontend/dialogs
tags: [dialogs, move-copy, workspace, organization, refactor]
dependency-graph:
  requires: []
  provides: [MoveOrCopyDialog]
  affects:
    - src/components/transcript-library/TranscriptTableRow.tsx
    - src/components/transcript-library/BulkActionToolbarEnhanced.tsx
    - src/components/call-detail/CallDetailHeader.tsx
tech-stack:
  added: []
  patterns: [move-or-copy-dialog]
key-files:
  created:
    - src/components/dialogs/MoveOrCopyDialog.tsx
    - src/components/dialogs/__tests__/MoveOrCopyDialog.test.tsx
  modified:
    - src/components/transcript-library/TranscriptTableRow.tsx
    - src/components/transcript-library/BulkActionToolbarEnhanced.tsx
    - src/components/call-detail/CallDetailHeader.tsx
    - src/components/call-detail/__tests__/PasteSourceRendering.test.tsx
  deleted:
    - src/components/dialogs/MoveToWorkspaceDialog.tsx
    - src/components/dialogs/CopyToOrganizationDialog.tsx
    - src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx
decisions:
  - "Reused useMoveRecordings exclusively (not useCopyToOrganization) — it already dispatches correctly for both same-org and cross-org cases and lets the user pick a specific target workspace instead of forcing the cross-org copy into the target org's HOME workspace."
  - "Kept useCopyToOrganization/useMoveToWorkspace hooks and moveRecordingsToWorkspace service untouched — out of scope, still used by the drag-and-drop path (useMoveToWorkspace) which was explicitly excluded from this plan."
metrics:
  duration: "~35 min"
  completed: "2026-07-22"
---

# Quick 260721-x8o: Consolidate MoveToWorkspaceDialog and CopyToOrganizationDialog Summary

One `MoveOrCopyDialog` (org picker → workspace picker → Move/Copy toggle) now replaces both `MoveToWorkspaceDialog` and `CopyToOrganizationDialog`, wired into the row menu, bulk toolbar, and call detail header (net-new move entry point there), dispatching entirely through the existing `useMoveRecordings` hook.

## What Was Built

- **`src/components/dialogs/MoveOrCopyDialog.tsx`** — Unified dialog. Organization select (from `useOrganizations()`, defaults to `activeOrgId`, marks current org, `+ New Organization` inline create form). Workspace select (from `useAllUserWorkspaces()`, filtered to the selected org, resets when org changes, `+ New Workspace` opens `CreateWorkspaceDialog` scoped to the selected org). Move/Copy segmented toggle driving `keepInSource` (Copy=true, Move=false). Contextual helper text (same-org vs cross-org). Submits via `useMoveRecordings().mutate(...)`.
- **`src/components/dialogs/__tests__/MoveOrCopyDialog.test.tsx`** — 4 behavior tests: same-org copy (keepInSource=true), same-org move (default toggle, keepInSource=false), cross-org move (org switch re-scopes workspace list, mismatched org ids in dispatch), and create-workspace scoped to a non-active selected org.
- **Call site rewiring:**
  - `TranscriptTableRow.tsx` — two dropdown menu items ("Move to Workspace" / "Copy to Organization") collapsed into one "Move or Copy…" item; two dialog renders collapsed into one.
  - `BulkActionToolbarEnhanced.tsx` — two Organize-section buttons collapsed into one "Move or Copy" button; two dialog renders collapsed into one, preserving the existing `onSuccess` cache-invalidation side effect.
  - `CallDetailHeader.tsx` — repurposed the existing "COPY" button into "MOVE / COPY" (net-new move capability on the call detail page — previously only copy was available there). Added `useOrganizationContext()` for `activeWorkspaceId` so same-org moves have a source workspace to relink from.
- **Retired:** `MoveToWorkspaceDialog.tsx`, `CopyToOrganizationDialog.tsx`, and `MoveToWorkspaceDialog.test.tsx` deleted.
- **Fixed as part of rewiring (Rule 3 — blocking issue):** `PasteSourceRendering.test.tsx` mocked `@/components/dialogs/CopyToOrganizationDialog`, which no longer exists after the delete. Updated its mock to `@/components/dialogs/MoveOrCopyDialog` and added a `useOrganizationContext` mock (needed because `CallDetailHeader` now calls that hook directly for `activeWorkspaceId`, and the test renders `CallDetailHeader` without a real org/query provider).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PasteSourceRendering.test.tsx` broke on old-dialog deletion**
- **Found during:** Task 2 verification (orphan-reference grep + full vitest run)
- **Issue:** The test file `vi.mock`'d `@/components/dialogs/CopyToOrganizationDialog`, which is now deleted, and rendered `CallDetailHeader` directly without mocking `useOrganizationContext` (a new dependency introduced by the rewire).
- **Fix:** Updated the mock target to `@/components/dialogs/MoveOrCopyDialog` and added a `useOrganizationContext` mock returning `{ activeOrgId: 'org-1', activeWorkspaceId: 'ws-1' }`.
- **Files modified:** `src/components/call-detail/__tests__/PasteSourceRendering.test.tsx`
- **Commit:** 4ee20310

**2. [Rule 3 - Blocking] Doc-comment literal match in the orphan-reference grep**
- **Found during:** Task 2 verification (`rg -l 'MoveToWorkspaceDialog|CopyToOrganizationDialog' src/`)
- **Issue:** `MoveOrCopyDialog.tsx`'s file-header doc comment named both retired components by their old identifiers, which the plan's verify command flags as a match (it checks for the literal strings anywhere in `src/`, not just imports).
- **Fix:** Reworded the doc comment to describe the retired dialogs functionally ("the previously separate same-org workspace-picker dialog and the cross-org organization-picker dialog") instead of naming them literally.
- **Files modified:** `src/components/dialogs/MoveOrCopyDialog.tsx`
- **Commit:** 08617ea2 (amended into initial creation, not a separate commit — caught before the first commit)

No other deviations. Plan executed as written otherwise.

## Verification Results

- `npx vitest run src/components/dialogs/__tests__/MoveOrCopyDialog.test.tsx` — 4/4 passed.
- `npx tsc -p tsconfig.app.json --noEmit` — 319 pre-existing errors, same count before and after this plan's changes (confirmed via diff); zero errors attributable to files touched by this plan.
- `rg -l 'MoveToWorkspaceDialog|CopyToOrganizationDialog' src/` — zero matches (clean).
- `npx vitest run` (full suite) — 2102 passed, 2 failed, 96 skipped. Both failures are pre-existing and unrelated: `supabase/functions/generate-ai-titles/__tests__/auth-invariants.test.ts` and `supabase/functions/mcp-server/__tests__/sec-jwt-fix.test.ts` (edge-function auth/security tests, outside this plan's file set, not touched by this plan).
- `npm run build` — succeeded (`vite build`, exit 0).

## Known Stubs

None.

## Threat Flags

None — the threat model's three registered threats (elevation-of-privilege via org/workspace pickers, tampering on cross-org dispatch, information disclosure on cross-org metadata) are all mitigated/accepted exactly as planned. No new network endpoints, auth paths, or schema changes were introduced; the dialog reuses the same membership-scoped hooks (`useOrganizations`, `useAllUserWorkspaces`) and the same `useMoveRecordings` dispatch path as before.

## Self-Check: PASSED

- FOUND: src/components/dialogs/MoveOrCopyDialog.tsx
- FOUND: src/components/dialogs/__tests__/MoveOrCopyDialog.test.tsx
- FOUND: commit 08617ea2 (feat: create unified MoveOrCopyDialog component)
- FOUND: commit 4ee20310 (refactor: rewire call sites, retire old dialogs)
- CONFIRMED: src/components/dialogs/MoveToWorkspaceDialog.tsx no longer exists
- CONFIRMED: src/components/dialogs/CopyToOrganizationDialog.tsx no longer exists
- CONFIRMED: zero references to retired dialog names in src/
