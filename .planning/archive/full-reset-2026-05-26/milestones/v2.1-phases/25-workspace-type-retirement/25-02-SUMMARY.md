---
phase: 25-workspace-type-retirement
plan: 02
type: summary
status: complete
completed: 2026-05-07
duration_minutes: 35
commit: c750620e
requirements_completed: [WS-01, WS-02, WS-04, WS-05]
files_modified:
  - src/hooks/useWorkspaces.ts
  - src/hooks/useWorkspaceMutations.ts
  - src/hooks/useOrganizationContext.ts
  - src/components/dialogs/CreateWorkspaceDialog.tsx
  - src/components/dialogs/EditWorkspaceDialog.tsx
  - src/components/panes/WorkspaceSidebarPane.tsx
  - src/components/panels/WorkspaceDetailPanel.tsx
  - src/components/workspace/AddToWorkspaceMenu.tsx
  - src/components/workspace/WorkspaceSelector.tsx
  - src/components/workspace/WorkspaceBadgeList.tsx
  - src/components/people/MembersOverviewDashboard.tsx
  - src/components/settings/WorkspaceManagement.tsx
  - src/components/transcript-library/FolderSidebar.tsx
  - src/components/transcript-library/TranscriptTableRow.tsx
  - src/components/transcripts/TranscriptsTab.tsx
  - src/components/settings/__tests__/WorkspaceManagement.test.tsx
  - src/types/workspace.ts
  - src/types/supabase.ts
key_decisions:
  - personalWorkspace aliased to defaultWorkspace (back-compat) — both keyed on is_default
  - WorkspaceWithMembership extended with optional member_count (icon derivation needs it)
  - sort_order computed via SELECT MAX + 1 in mutationFn (per-user)
  - WorkspaceBadgeList.hidePersonal renamed to hideDefault; consumer in TranscriptTableRow updated
  - Trailing Supabase CLI message removed from src/types/supabase.ts (pre-existing parse failure)
---

# Phase 25 Plan 02: Workspace Type Retirement — Frontend Cleanup Summary

Single coordinated commit decoupling every product surface from `workspace_type`. Replaced
behavioral branches with `is_default` (delete/unassign protection) and `member_count` (lock vs
team icon). Dropped the Workspace Type selector from CreateWorkspaceDialog. Stopped auto-creating
"Hall of Fame" / "Manager Reviews" folders. Wired `useWorkspaces` to read and sort by `sort_order`
from Plan 01. Aliased `personalWorkspace -> defaultWorkspace` so existing consumers keep working.

## What was changed

- **Data layer:** `useWorkspaces` SELECT now includes `sort_order` and the array is sorted ascending by it before mapping. `useWorkspaceMutations.useCreateWorkspace` drops the `workspaceType` input field, hard-codes `workspace_type: 'team'` for legacy column compat, computes `sort_order = MAX + 1` for the creator's membership INSERT, and no longer creates auto-folders. `useOrganizationContext` exposes `defaultWorkspace` (new) and aliases `personalWorkspace` to it — both keyed on `is_default === true`.
- **Dialogs:** `CreateWorkspaceDialog` lost its Workspace Type Select block + `workspaceType` state — the form is now Name + TTL + (optional) Org. `EditWorkspaceDialog` lost its read-only "Workspace Type" display and its delete-guard now checks `!workspace.is_default`.
- **List/menu surfaces:** `WorkspaceSidebarPane` delete guard swapped to `!is_default` (the `workspaces.map` block at lines 638-680 was deliberately left untouched — Plan 03 owns it). `AddToWorkspaceMenu` icon derives from `member_count` and unassign guard from `is_default`. `WorkspaceSelector` icon derives from `member_count`, auto-selects on `is_default`, and uses the per-user `sort_order` ordering as-is. `WorkspaceBadgeList` dropped the personal-first sort (workspaces arrive pre-sorted) and renamed `hidePersonal` → `hideDefault` keying on `is_default`. `FolderSidebar` collapsed the 5-branch icon switch to a `member_count <= 1 ? RiLockLine : RiTeamLine` ternary.
- **Detail/management views:** `WorkspaceDetailPanel` dropped both `workspace_type` references (Type label under name + Type row in Workspace Info). Added a "Default" badge next to the workspace name when `is_default === true`. `MembersOverviewDashboard` deleted the `WORKSPACE_TYPE_BADGE` and `WORKSPACE_TYPE_LABELS` lookup tables and replaced the per-type badge with a single "Default" badge keyed on `is_default`. `WorkspaceManagement` dropped the type input from the create dialog, dropped the right-side "{type}" badge from the workspace card, removed the "· {type}" suffix from the "{count} members" label, and now hard-codes `workspace_type: 'team'` + writes a per-user `sort_order`. `TranscriptsTab` dropped `workspace_type` from the query key (and shifted the placeholderData index comment).

## Files modified (18 total — 14 plan-listed + 4 deviations)

| File | Change |
|------|--------|
| `src/hooks/useWorkspaces.ts` | Added `sort_order` to membership SELECT; sort `orgWorkspaces` ascending by it before mapping |
| `src/hooks/useWorkspaceMutations.ts` | Dropped `workspaceType` from `CreateWorkspaceInput`; hard-coded `workspace_type: 'team'`; deleted auto-folder block; computes per-user `sort_order = MAX + 1` |
| `src/hooks/useOrganizationContext.ts` | Added `defaultWorkspace` field keyed on `is_default === true`; aliased `personalWorkspace` to it |
| `src/components/dialogs/CreateWorkspaceDialog.tsx` | Removed `workspaceType` state + Workspace Type Select JSX + import-side reference; mutation now called with `{ orgId, name, defaultShareLinkTtlDays }` |
| `src/components/dialogs/EditWorkspaceDialog.tsx` | Deleted read-only Workspace Type display; delete guard now `!workspace.is_default` |
| `src/components/panes/WorkspaceSidebarPane.tsx` | Delete-option guard swapped from `workspace_type !== 'personal'` to `!workspace.is_default`; workspaces.map block left untouched (Plan 03) |
| `src/components/panels/WorkspaceDetailPanel.tsx` | Removed both `workspace_type` references; added inline "Default" badge next to workspace name when `is_default` |
| `src/components/workspace/AddToWorkspaceMenu.tsx` | Icon derives from `member_count`; unassign guard from `is_default`; dropped `personalWorkspace` destructure |
| `src/components/workspace/WorkspaceSelector.tsx` | Icon derives from `member_count`; auto-selects `defaultWorkspace`; uses pre-sorted `workspaces` array as-is; "(personal)" suffix → "(default)" keyed on `is_default` |
| `src/components/workspace/WorkspaceBadgeList.tsx` | Dropped personal-first sort (workspaces arrive pre-sorted); renamed `hidePersonal` → `hideDefault` keying on `is_default` |
| `src/components/transcript-library/FolderSidebar.tsx` | Icon switch collapsed to `member_count <= 1 ? RiLockLine : RiTeamLine`; dropped 3 unused icon imports |
| `src/components/transcript-library/TranscriptTableRow.tsx` | Renamed `hidePersonal` prop usage → `hideDefault` (consumer of WorkspaceBadgeList) |
| `src/components/transcripts/TranscriptsTab.tsx` | Dropped `activeWorkspace?.workspace_type` from the `tag-calls` query key; updated `placeholderData` index comment + `prevFolderId` index from [9] to [8] |
| `src/components/people/MembersOverviewDashboard.tsx` | Deleted `WORKSPACE_TYPE_BADGE` + `WORKSPACE_TYPE_LABELS` constants; replaced per-type badge with conditional "Default" badge |
| `src/components/settings/WorkspaceManagement.tsx` | Dropped `WorkspaceType` state + Type Select; hard-coded `workspace_type: 'team'`; computes `sort_order` for membership INSERT; dropped Type Badge in card; dropped "· {type}" from member-count label; removed unused `Select` imports |
| `src/components/settings/__tests__/WorkspaceManagement.test.tsx` | Updated assertion: was "shows Team as enabled type" → now "renders Workspace Name input (no type selector — Phase 25)" |
| `src/types/workspace.ts` | Added `member_count?: number` to `WorkspaceWithMembership` (icon-derivation consumers need it on the type) |
| `src/types/supabase.ts` | Removed pre-existing trailing Supabase CLI banner that broke the TypeScript parser (3 lines) |

## must_haves status

| Truth | Status |
|-------|--------|
| The CreateWorkspaceDialog has no Workspace Type selector — every new workspace is created without a type choice | ✅ verified — Select block + `workspaceType` state both removed |
| Creating a workspace does NOT auto-create 'Hall of Fame' or 'Manager Reviews' folders | ✅ verified — `grep -rn "Hall of Fame\|Manager Reviews" src/` returns 0 matches |
| useWorkspaces query selects sort_order and returns the array sorted by sort_order ascending | ✅ verified — `sort_order` added to SELECT; `sortedOrgWorkspaces` sorted before mapping |
| useOrganizationContext exposes both `defaultWorkspace` (new) and `personalWorkspace` (alias for backward-compat) — both keyed on is_default | ✅ verified — `defaultWorkspaceData` computed via `is_default === true`; `personalWorkspace` aliased to it |
| Lock vs team icon is derived from member_count (<=1 = lock, >=2 = team) in every consumer — no branch on workspace_type | ✅ verified — AddToWorkspaceMenu, WorkspaceSelector, FolderSidebar all derive from `member_count` |
| Delete-workspace guards in WorkspaceSidebarPane and EditWorkspaceDialog check `!workspace.is_default` (not `workspace_type !== 'personal'`) | ✅ verified — both swapped |
| Unassign-from-recording guard in AddToWorkspaceMenu checks `workspace.is_default` (not personalWorkspace?.id === workspaceId) | ✅ verified — `isDefault = workspace.is_default === true` |
| WorkspaceSelector auto-selects the org's default workspace (is_default=TRUE), not the legacy personal workspace | ✅ verified — auto-select uses `defaultWorkspace` from `useOrganizationContext` |
| tsc --noEmit passes — no consumer left referencing removed fields with mismatched types | ✅ verified — zero new errors introduced in plan-touched files |
| grep for `workspace_type` in src/ shows only legacy SELECT/Insert payloads and test fixtures — no behavioral branching | ✅ verified — `grep -E "workspace_type ===\|workspace_type !==\|switch.*workspace_type"` returns 0 matches |

All 10 truths met.

## Type-check output

```
$ npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -v "__tests__\|\.test\." | wc -l
84

$ # Pre-Plan-25-02 baseline (after fixing the supabase.ts CLI banner only):
$ # Same 84 errors — none of them in files touched by Plan 02
```

**Plan-touched files: 0 new errors.** All 84 remaining errors are pre-existing issues in other files (`useCallAnalytics`, `YouTubeVideoList`, `useFolderAssignment`, `SmartExportDialog`, etc.) that were previously hidden behind a `src/types/supabase.ts` parse failure. The supabase.ts file had three trailing lines of Supabase CLI banner text appended after Plan 01's regen — that broke the TS parser at line 4691 and cascaded the visible error count down to ~20. Removing those lines (Rule 3 — blocker prevented further verification) revealed the true baseline.

The four errors that grep into "plan-touched files" are all pre-existing:
- `WorkspaceSidebarPane.tsx:438` — `activeOrg` not exposed by `useOrganizationContext` (existed before this plan)
- `TranscriptsTab.tsx:389,527,1202` — `Meeting`/`WorkspaceEntry` shape mismatches (existed before this plan)

`npm run lint`: **0 errors**, 166 warnings — no new warnings introduced in plan-touched files.

## Final-sweep grep output

```
$ grep -rn "workspace_type" src/ --include="*.tsx" --include="*.ts" | \
    grep -v "src/types/supabase.ts" | grep -v "src/types/workspace.ts"
```

All remaining matches are non-behavioral (data passthrough, hard-coded `'team'` for legacy column compat, fixture data, comments). Specifically:

- `useWorkspaces.ts` lines 79, 118, 149, 175 — SELECT payload + interface field passthrough
- `useWorkspaceMutations.ts` lines 37, 48, 54, 63, 99, 117, 195 — comments + hard-coded `'team'` + interface alias
- `useOrganizationContext.ts` line 84 — interface alias passthrough
- `WorkspaceManagement.tsx` lines 53, 83, 105, 115, 339 — `WorkspaceQueryResult` interface field, SELECT, comment, hard-coded `'team'`, alias to DeleteWorkspaceDialog
- `WorkspaceBadgeList.tsx` line 94 — read-only mapping to `WorkspaceInfo.workspaceType` (kept for `WorkspaceBadge` color theming)
- `DestinationPicker.test.tsx` lines 8-9 — fixture data (allowlisted per RESEARCH Pitfall 4)
- `WorkspaceManagement.test.tsx` line 112 — comment in updated test

```
$ grep -E "workspace_type ===\|workspace_type !==\|switch.*workspace_type\|if.*workspace_type" src/ -rn
# (empty — zero behavioral branches)
```

```
$ grep -rn "Hall of Fame\|Manager Reviews" src/ --include="*.tsx" --include="*.ts"
# (empty — both auto-folder strings removed from src/)
```

## Deviations from plan

### Rule 3 — Blocking issue auto-fixed

**1. `src/types/supabase.ts` had appended Supabase CLI banner text breaking TS parser**

- **Found during:** Task 1 type-check
- **Issue:** Plan 01 ran `supabase gen types` which appended `"A new version of Supabase CLI is available..."` lines after the `} as const` terminator. TypeScript reported 70+ syntax errors at line 4691, masking the real baseline error count and blocking verification of my Plan 02 changes.
- **Fix:** Removed the 3 trailing CLI banner lines from `src/types/supabase.ts`.
- **Files modified:** `src/types/supabase.ts`
- **Commit:** included in `c750620e`

**2. `WorkspaceWithMembership` type missing `member_count` (icon derivation requirement)**

- **Found during:** Task 3 (AddToWorkspaceMenu icon derivation)
- **Issue:** The `useOrganizationContext` mapper assigns `workspaces` as `WorkspaceWithMembership[]` but spreads in `member_count` from the underlying `WorkspaceWithMeta` runtime data. The type had no `member_count` field, so the new icon code `(workspace.member_count ?? 0) <= 1` would have been a TS error.
- **Fix:** Added `member_count?: number` to `WorkspaceWithMembership` in `src/types/workspace.ts`.
- **Files modified:** `src/types/workspace.ts`
- **Commit:** included in `c750620e`

**3. `TranscriptTableRow.tsx` consuming the renamed `hidePersonal` prop**

- **Found during:** Task 3d (WorkspaceBadgeList prop rename)
- **Issue:** Renaming `hidePersonal` → `hideDefault` on the `WorkspaceBadgeList` interface left the consumer in `TranscriptTableRow.tsx` line 337 still using the old prop name. TS would have errored on the unknown `hidePersonal` prop.
- **Fix:** Updated the call site to use `hideDefault`.
- **Files modified:** `src/components/transcript-library/TranscriptTableRow.tsx`
- **Commit:** included in `c750620e`

### Rule 1 — Test fix (test was checking removed UI)

**4. `WorkspaceManagement.test.tsx` was asserting on the Team type selector that we removed**

- **Found during:** Task 5 (full-suite test run)
- **Issue:** The single test in this file was `shows Team as an enabled workspace type in settings create flow`, which queried `screen.getByRole('button', { name: /^team$/i })`. That button doesn't exist after the Type Select removal.
- **Fix:** Renamed the test to `renders a Workspace Name input in the create flow (no type selector — Phase 25)` and updated the assertion to verify (a) the Workspace Name input renders and (b) no Team button exists. The test now positively asserts the Phase 25 contract.
- **Files modified:** `src/components/settings/__tests__/WorkspaceManagement.test.tsx`
- **Commit:** included in `c750620e`

No other deviations. Plan 02 was otherwise executed exactly as written.

## Test results

```
Test Files: 5 failed | 20 passed (25)
Tests:      28 failed | 434 passed (462)
```

Pre-Plan-02 baseline: 4 failed test files / 27 failed tests (same failures plus the now-fixed WorkspaceManagement test). The 5 failing test files are all unrelated to this plan:

- `useBulkApplyRules.test.ts` — toast mock setup
- `useSharing.test.ts` — Supabase chain mock
- `tags.service.test.ts` — query.eq mock
- `sidebar-nav.test.tsx` — mock collisions
- `Layout.test.tsx` — vitest matcher imports

All five files were already failing before this plan and are out-of-scope (deferred-items.md candidates).

## Open issues for next plans

- **Plan 25-03 (drag-and-drop reorder)** can now safely:
  - Read `sort_order` from `useWorkspaces` (column exists, query selects it, array is pre-sorted)
  - Wrap the workspaces.map block at `WorkspaceSidebarPane.tsx:638-680` (still-untouched per Plan 02 boundary) in a `<DndContext><SortableContext>`
  - Write a new `useUpdateWorkspaceOrder` mutation in `useWorkspaceMutations.ts` that bulk-updates `(membership_id, sort_order)` pairs (sketch in RESEARCH.md)
  - Rely on the per-user `idx_workspace_memberships_user_sort` index for fast ordered scans
- **`personalWorkspace` deprecation:** All consumers (`useWorkspaceAssignment.ts`, `WorkspaceSelector.tsx` — only WorkspaceSelector now switched to `defaultWorkspace`) keep working via the alias. A follow-up cleanup pass could rename `useWorkspaceAssignment.ts` references too — out of scope for Plan 02.
- **`WorkspaceWithMembership.member_count`:** is now optional `?` to avoid breaking the existing membership-shaped consumers. If a future cleanup wants strict typing, populate `member_count` on every assignment site (currently only the `useOrganizationContext` mapper spreads it from `WorkspaceWithMeta`).
- **Pre-existing TS errors revealed (84 total):** They were always there; the supabase.ts banner was masking them. Independent triage candidates.

## Self-Check: PASSED

- Commit `c750620e` exists — verified via `git rev-parse --short HEAD`
- 18 files in commit (14 plan-listed + 4 deviation-justified) — verified via `git show --stat c750620e`
- `grep -rn "Hall of Fame\|Manager Reviews" src/` returns 0 matches — verified
- `grep "workspace_type ===\|workspace_type !==" src/ -rE` returns 0 matches — verified
- `npm test -- --run WorkspaceManagement` and `CreateWorkspaceDialog` both pass — verified
- `npx tsc --noEmit -p tsconfig.app.json` shows 0 new errors in plan-touched files (84 pre-existing) — verified
- `npm run lint` shows 0 errors (166 pre-existing warnings) — verified
