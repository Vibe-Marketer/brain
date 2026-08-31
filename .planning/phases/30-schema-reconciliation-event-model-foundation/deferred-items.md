# Phase 30 — Deferred Items

Out-of-scope discoveries logged per the executor's scope-boundary rule (fix only what the
current task's changes directly caused; log everything else here instead of fixing it).

## Pre-existing `npm run type-check` failures absorbed into the baseline during Plan 30-01

**Found during:** Plan 30-01, Task 1 (regenerating `src/types/supabase.ts`).

**What happened:** After regenerating types from live prod and running `npm run type-check`,
16 new (un-baselined) error keys appeared. Isolation testing (temporarily restoring the stale
committed `src/types/supabase.ts` via `git checkout -- src/types/supabase.ts`, re-running
`npm run type-check`, then restoring the regenerated file) showed **11 of the 16 already fail
with the OLD, stale types file** — i.e., they are unrelated to this plan's type regeneration.
A second check confirmed `v2.2-event-resolution` has zero code-diverging commits from
`origin/main` (only 9 `docs(30)`/milestone-setup commits) — so these 11 errors are live on
production `main` today, not something this branch or this plan introduced.

Because Plan 30-01 is scoped to touch only `src/types/supabase.ts` and (conditionally)
`type-baseline.json` — fixing these would require editing unrelated component/hook files,
which is out of scope for this plan — `npm run type-check:update-baseline` was run once,
which captured all 16 current error keys (5 legitimately caused by the type regeneration,
plus these 11 pre-existing ones) into `type-baseline.json`. This satisfies Task 1's
acceptance criteria (`npm run type-check` exits 0) without touching forbidden files, but it
means these 11 pre-existing bugs are now silently tolerated by the baseline rather than
flagged as new. They still need to be fixed by a future task — baselining is not fixing.

**The 11 pre-existing, unrelated issues (confirmed present on `origin/main` today):**

| File | Error | Likely cause |
|------|-------|--------------|
| `src/components/panels/AutomationRulePanel.tsx` (lines 56, 73, 89) | `TS2304: Cannot find name 'PaneHeader'` | Missing import — component references `PaneHeader` without importing it |
| `src/components/panels/FolderDetailPanel.tsx` (line 258) | `TS2304: Cannot find name 'PaneHeader'` | Same missing import pattern |
| `src/components/panels/RoutingRulePanel.tsx` (line 145) | `TS2304: Cannot find name 'PaneHeader'` | Same missing import pattern |
| `src/components/panels/SettingHelpPanel.tsx` (line 160) | `TS2304: Cannot find name 'PaneHeader'` | Same missing import pattern |
| `src/components/panels/TagDetailPanel.tsx` (lines 226, 268) | `TS2304: Cannot find name 'PaneHeader'` | Same missing import pattern |
| `src/components/panels/UserDetailPanel.tsx` (line 206) | `TS2304: Cannot find name 'PaneHeader'` | Same missing import pattern |
| `src/components/panels/WorkspaceDetailPanel.tsx` (line 109) | `TS2304: Cannot find name 'PaneHeader'` | Same missing import pattern |
| `src/components/transcript-library/FolderManagementDialog.tsx` (line 161) | `TS2304: Cannot find name 'RiFolderOpenLine'` | Missing Remix Icons import |
| `src/hooks/useContacts.ts` (line 565) | `TS2322`: returned row shape not assignable to `ContactWithCallCount[]` | Service/hook type drift, unrelated to Supabase schema |
| `src/hooks/useContactSuggestions.ts` (line 51) | `TS2589: Type instantiation is excessively deep and possibly infinite` | Pre-existing generic-inference blowup |
| `src/services/mcp-oauth-grants.service.ts` (line 179) | `TS2322`: returned row shape not assignable to `McpOAuthGrantConnection[]` | Service/hook type drift, unrelated to Supabase schema |

**Recommendation:** A future cleanup task (not this milestone's SAFE-07 scope) should add the
missing `PaneHeader`/`RiFolderOpenLine` imports (7 files touch `PaneHeader`, 1 touches
`RiFolderOpenLine`) and reconcile the two service/hook type mismatches
(`useContacts.ts`, `useContactSuggestions.ts`, `mcp-oauth-grants.service.ts`).

**Status:** Open — not fixed, only tolerated in the baseline. Not blocking Phase 30 (SAFE-07 is
documentation + tooling only per its own scope), but should not be forgotten.
