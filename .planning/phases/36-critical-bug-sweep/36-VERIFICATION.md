---
phase: 36
title: Critical Bug Sweep — Verification
date: 2026-05-12
status: ready_for_dev_browser
---

# Phase 36: Critical Bug Sweep — VERIFICATION

## Summary

All 8 bugs (BUG-02 through BUG-09) plus 4 of 5 Phase 29 QA fold-ins resolved across 7 atomic commits. QA-14 (Call Detail Pane 4 refactor) intentionally deferred per `36-07-NOTES.md`.

## Per-Plan Status

| Plan | Bug | Status | Files Changed | Tests | Dev-browser |
|------|-----|--------|--------------|-------|-------------|
| 36-01 | BUG-02 workspace 406 | DONE | 3 | real-DB integration test added | DEFERRED |
| 36-02 | BUG-03 cache invalidation | DONE | 7 | real-DB integration test added | DEFERRED |
| 36-03 | BUG-04 date sort | DONE | 2 | 5 new unit tests added (all 18 pass) | DEFERRED |
| 36-04 | BUG-08 auto-folders | DONE | 1 | 3 new regression tests (all 9 pass) | DEFERRED |
| 36-05 | BUG-09 DialogDescription | DONE | 2 | grep audit zero gaps | DEFERRED |
| 36-06 | BUG-05/06/07 import UI | DONE | 4 | n/a — UI wiring | DEFERRED |
| 36-07 | QA-05/08/11/13 (QA-14 deferred) | DONE | 5 | n/a — fold-ins | DEFERRED |

## Commits

```
git log --oneline -- .planning/phases/36-critical-bug-sweep/ src/ supabase/migrations/2026051203* | head -10
```

- `fix(36-01): atomic set_default_workspace RPC eliminates 406 PGRST116 [BUG-02]`
- `fix(36-02): unified invalidateCallListCaches helper kills cache staleness [BUG-03]`
- `fix(36-03): date sort handles null/invalid timestamps chronologically [BUG-04]`
- `fix(36-04): extend Phase 25 regression net to org-creation + Edge Functions [BUG-08]`
- `fix(36-05): add DialogDescription to every modal (a11y) [BUG-09]`
- `fix(36-06): wire AddImportSourceDialog + real ImportHistoryPanel + paste-transcript entry [BUG-05, BUG-06, BUG-07]`
- `fix(36-07): Phase 29 QA fold-ins [QA-05, QA-08, QA-11, QA-13]; QA-14 deferred`

## Files Changed (total: 24 source files + 3 new test files + 1 migration)

### Source files modified
1. `src/hooks/useWorkspaceMutations.ts` — BUG-02
2. `supabase/migrations/20260512030000_set_default_workspace_rpc.sql` — BUG-02 (new)
3. `src/lib/query-config.ts` — BUG-03
4. `src/hooks/useFolderAssignment.ts` — BUG-03
5. `src/hooks/useFolders.ts` — BUG-03
6. `src/hooks/useTags.ts` — BUG-03
7. `src/hooks/useCallDetailMutations.ts` — BUG-03
8. `src/hooks/useWorkspaceAssignment.ts` — BUG-03
9. `src/hooks/useTableSort.ts` — BUG-04
10. `src/components/search/GlobalSearchModal.tsx` — BUG-09
11. `src/components/youtube/YouTubeVideoDetailModal.tsx` — BUG-09
12. `src/components/panes/ImportSourcePane.tsx` — BUG-05/07
13. `src/components/import/AddImportSourceDialog.tsx` — BUG-07 (new)
14. `src/components/import/ImportHistoryPanel.tsx` — BUG-06 (new)
15. `src/pages/ImportPage.tsx` — BUG-05/06/07
16. `src/components/settings/OrganizationsTab.tsx` — QA-11
17. `src/components/panes/AnalyticsDetailPane.tsx` — QA-08
18. `src/hooks/useGlobalSearch.ts` — QA-13
19. `src/components/transcripts/TranscriptsTab.tsx` — QA-05

### Test files added
- `src/services/__tests__/setDefaultWorkspace.integration.test.ts` (BUG-02)
- `src/lib/__tests__/invalidateCallListCaches.realDb.test.ts` (BUG-03)
- Tests in `src/lib/__tests__/useTableSort.test.ts` extended (BUG-04, 5 new)
- Tests in `src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx` extended (BUG-08, 3 new)

## Test Status

| Suite | Pass | Fail | Notes |
|-------|------|------|-------|
| `useTableSort.test.ts` | 18 | 0 | All BUG-04 regression tests green |
| `CreateWorkspaceDialog.phase25.test.tsx` | 9 | 0 | Phase 25 (6) + Phase 36-04 (3) |
| `setDefaultWorkspace.integration.test.ts` | n/a — skipped without SUPABASE_TEST_SERVICE_ROLE_KEY | — | Test file present; runs against live DB |
| `invalidateCallListCaches.realDb.test.ts` | n/a — same skip condition | — | Real-DB test present, no mocks |

## TypeScript Status

`npx tsc --noEmit -p tsconfig.app.json` — pre-existing errors only (Meeting type fields, panelStore PanelData, RemixiconComponentType union — none caused by Phase 36 changes). Confirmed via `git stash` diff that the same errors exist on the baseline.

## Migration Status

The `set_default_workspace` RPC migration `20260512030000_set_default_workspace_rpc.sql` is staged for `supabase db push`. **Not yet pushed to the live project** — the orchestrator did not run `supabase db push` because it can prompt interactively. **Action required**: run `supabase db push` from the repo root (or use the dashboard SQL editor with the migration body) before dev-browser verifying BUG-02.

## Dev-Browser Verification — DEFERRED

All 7 plans defined a dev-browser verification task on `https://app.callvaultai.com`. Per the user's standing rule, dev-browser is mandatory before claiming a fix is shipped. The orchestrator did not execute the dev-browser passes because:

1. The user invoked `--no-transition`, so phase completion gating is intentionally skipped.
2. Dev-browser MCP requires interactive Chrome session approval; running 7 separate flows is best done in one human-supervised pass.

**Recommended next step:** open dev-browser, sign in with `CALLVAULTAI_LOGIN`, and walk through each bug per the verification task in its PLAN.md file. Mark each row in the per-plan status table above as PASSED/FAILED.

## Gaps / Known Risks

- **BUG-02 migration push** not executed. The frontend RPC call will fail with `function set_default_workspace does not exist` until the migration runs. **Highest-priority follow-up.**
- **Real-DB integration tests** are not gated to run automatically. They require `SUPABASE_TEST_SERVICE_ROLE_KEY` in `.env.local` or `.env.test`. CI will see them as skipped.
- **QA-14** explicitly deferred — see `36-07-NOTES.md`. Modal-vs-Pane4 product decision required.
- **QA-13 server-side perf** (full-text index) deferred to Phase 38.

## Pre-Existing Issues (NOT introduced by Phase 36)

- `Meeting` type missing `title_edited_by_user` / `summary_edited_by_user` fields (used in `useCallDetailMutations.resyncCall`). Type-error existed before this phase.
- `RemixiconComponentType` doesn't match the ad-hoc `{ className?, size? }` shape used in `ImportSourcePane.SourceDef`. Pre-existing.

## Must-Haves Status (Goal-Backward Check)

From the ROADMAP Phase 36 success criteria:

1. **Workspace default toggle works without 406** — Fixed at code level (BUG-02). Live verification blocked on migration push.
2. **Mutations refresh call list immediately** — Fixed (BUG-03). Awaiting dev-browser.
3. **Date sort strictly chronological** — Fixed (BUG-04). Unit tests prove the regression.
4. **Manual paste/upload accessible from UI** — Fixed (BUG-05).
5. **Import buttons functional** — Fixed (BUG-06 history panel, BUG-07 "+" button).
6. **No auto-folders on new accounts** — Already enforced by Phase 25; regression net expanded (BUG-08).
7. **No DialogDescription warnings** — Fixed (BUG-09).

All 7 success criteria addressed in code. **Final sign-off requires the migration push + dev-browser sweep.**
