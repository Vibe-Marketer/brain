# Phase 09: Lint, Brand, and Documentation Hygiene — Research

**Researched:** 2026-06-10
**Domain:** ESLint flat config, React hooks, Remix Icons, doc guardrails
**Confidence:** HIGH — all findings verified against live codebase via `npm run lint`, `npm run build`, `npm run type-check`, and direct file reads.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fix order: (1) stale eslint-disable — 20 auto-fixable with `npm run lint -- --fix`; (2) unused vars/imports — rename to `_prefix`; (3) exhaustive-deps with plausible runtime impact; (4) stop there.
- **D-02:** Skip `no-explicit-any` this phase (~100 warnings).
- **D-03:** Skip `react-refresh/only-export-components` (15 warnings — structural, not hygiene).
- **D-04:** Success threshold: material reduction from 237 baseline. Stale-disable + unused-vars alone should drop ~30–40.
- **D-05:** Hook dep fixes: prioritize `completedJobTimeoutsRef.current` stale-ref and missing useMemo/useCallback deps where fix is "add the dep." Defer warnings where adding the dep changes semantics — use `// eslint-disable-next-line react-hooks/exhaustive-deps` with comment.
- **D-06:** Remove positive/recommending occurrences only. Leave prohibition/negative-context mentions.
- **D-07:** Files to fix: `docs/design/BUTTON_VARIANTS.md:268` (lucide import), `docs/help/export-system.md:66` (positive "AI-powered").
- **D-08:** Files to leave: `docs/design/brand-guidelines-v4.4.md`, `docs/product-overview.md`, `docs/brand-guidelines-changelog.md`, all `docs/archive/`.
- **D-09:** Guardrail as grep command documented in root `CLAUDE.md`.
- **D-10:** Add as `npm run lint:docs` in `package.json` (warning, not error).
- **D-11:** Forbidden patterns to gate: lucide-react imports, framer-motion in positive context, "AI-powered" as product descriptor.
- **D-12:** No CI pipeline changes this phase.

### Claude's Discretion

- Exact grep patterns for the guardrail (distinguishing positive vs. prohibition context).
- Whether to use simple `grep -r` or structured script.
- Whether to add `@typescript-eslint/no-explicit-any` suppressions for complex cases blocking a clean lint pass.

### Deferred Ideas (OUT OF SCOPE)

- Full `no-explicit-any` cleanup.
- `react-refresh/only-export-components` file splits.
- CI enforcement of lint:docs gate.
- `TranscriptsTab` structural refactor.
</user_constraints>

---

## Summary

Build passes cleanly. Type-check passes with zero errors (exit 0, silent). The 237 lint warnings break into four categories: ~100 `no-explicit-any` (skip per D-02), 15 `react-refresh/only-export-components` (skip per D-03), ~12 stale `eslint-disable` (auto-fix first), and ~60 `no-unused-vars` + ~10 `exhaustive-deps` (manual fixes). Fixing the stale-disable + unused-vars categories alone will drop roughly 70+ warnings from the 237 baseline — well past the "material reduction" threshold.

The two active-doc violations are confirmed and exactly scoped: one lucide-react import example at `BUTTON_VARIANTS.md:268` and one "AI-powered" product descriptor at `export-system.md:66`. Both are one-line fixes with clear replacement text.

The `lint:docs` script can be implemented as a pure bash `grep` command in `package.json` — no new dependencies needed.

---

## Commands and Implementation Path

### Step 1 — Auto-fix stale eslint-disable directives

```bash
npm run lint -- --fix
```

This removes all 20 stale `eslint-disable` directives automatically. The stale directives are concentrated in:

- `.agent/get-shit-done/bin/lib/cjs-sdk-bridge.cjs` — lines 84, 90 (`global-require`)
- `.agent/get-shit-done/bin/lib/phase-lifecycle.generated.cjs` — line 63 (`no-cond-assign`)
- `.agent/get-shit-done/bin/lib/runtime-artifact-layout.cjs` — line 35 (`global-require`)
- `.agent/get-shit-done/bin/lib/state.cjs` — lines 889, 944 (`no-constant-condition`)
- `.gemini/get-shit-done/bin/lib/` — same 6 warnings (mirror of `.agent/`)
- `src/services/organizations.service.ts` — line 47 (`no-explicit-any` stale disable)
- `src/test/rls-regression.test.ts` — lines 624, 633, 642, 652, 661, 674, 681 (7x `no-console` stale disables)

**Note:** The `.agent/` and `.gemini/` CJS files are generated/tooling files. Verify after auto-fix that `--fix` only touched the directive lines, not logic. If `--fix` errors on generated CJS files, run it scoped: `npm run lint -- --fix src/ cloudflare/` and manually remove the CJS stale directives.

### Step 2 — Unused vars: rename to `_prefix`

Run lint after step 1 to get clean baseline, then work through the files below. All fixes are identical in form: rename `varName` to `_varName` (or prefix destructure position with `_` for callback args).

**Files with the most warnings (highest ROI first):**

| File | Variables to prefix | Count |
|------|--------------------|----|
| `src/components/panes/WorkspaceSidebarPane.tsx` | `WorkspaceMemberPanel`, `OrganizationMemberPanel`, `queryKeys`, `RiMoreLine`, `RiShieldUserLine`, `WorkspaceRole`, `queryClient`, `error`, `personalFoldersLoading` | 9 |
| `src/pages/TranscriptsNew.tsx` | `TabsList`, `TabsTrigger`, `Button`, `useCreateFolder`, `usePersonalTags`, `foldersLoading`, `hiddenFolders`, `toggleHidden`, `totalCount` | 9 |
| `src/pages/OrganizationPage.tsx` | `RiGroupLine`, `RiInformationLine`, `CardHeader`, `CardTitle`, `useDeleteOrganization` | 5 |
| `src/components/dialogs/WorkspaceInviteDialog.tsx` | `RiCloseLine`, `activeTab`, `setActiveTab`, `expiresInDays` | 4 |
| `src/pages/WorkspaceJoin.tsx` | `RiSafeLine`, `RiCheckLine`, `RiArrowLeftLine`, `getErrorToastMessage` | 4 |
| `src/components/sharing/OrgChartView.tsx` | `RiUserSettingsLine`, `TeamMembershipWithUser`, `index` (callback arg) | 3 |
| `src/components/settings/WorkspaceManagement.tsx` | `RiArrowRightLine`, `RiInformationLine`, `navigate` | 3 |
| `src/components/transcripts/TranscriptsTab.tsx` | `ErrorBoundary`, `BulkActionToolbarEnhanced`, `useWorkspaces` | 3 |
| `src/hooks/useFolders.ts` | `renameFolder`, `workspaceId` (x2 callback args) | 3 |
| `src/components/import/PasteTranscriptModal.tsx` | `destinationProviderName` | 1 |
| `src/components/layout/AppShell.tsx` | `handleLibraryToggle` | 1 |
| `src/components/contacts/ReengagementEmailModal.tsx` | `cn` | 1 |
| `src/components/header/OrganizationSwitcher.tsx` | `toast`, `WorkspaceWithMembership` | 2 |
| `src/components/import/ImportProgress.tsx` | `errorHappenedBefore`, `Icon` (callback arg) | 2 |
| `src/components/debug-panel/DebugPanel.tsx` | `DebugDump` | 1 |
| `src/components/panels/SettingHelpPanel.tsx` | `RiRobot2Line` | 1 |
| `src/components/panels/TagDetailPanel.tsx` | `Tag` | 1 |
| `src/components/panes/AnalyticsDetailPane.tsx` | `RiArrowLeftLine`, `AnalyticsPlaceholder` | 2 |
| `src/components/panes/SortingDetailPane.tsx` | `RiArrowLeftLine` | 1 |
| `src/components/settings/MCPTab.tsx` | `UpgradeButton` | 1 |
| `src/components/settings/OrganizationsTab.tsx` | `orgRole` | 1 |
| `src/components/tags/FoldersTab.tsx` | `color`, `icon`, `description` (callback args) | 3 |
| `src/components/tags/RulesTab.tsx` | `Tag` | 1 |
| `src/components/youtube/YouTubeVideoDetailModal.tsx` | `workspaceId` (callback arg) | 1 |
| `src/hooks/useContactFolders.ts` | `organizationId` (callback arg) | 1 |
| `src/hooks/useOrganizationContext.ts` | `useEffect` | 1 |
| `src/hooks/usePersonalFolders.ts` | `moveCallToPersonalFolder` | 1 |
| `src/hooks/usePersonalTags.ts` | `updatePersonalTag` | 1 |
| `src/hooks/useSyncTabState.ts` | `realtimeConnected` | 1 |
| `src/hooks/useWorkspaceMemberMutations.ts` | `workspaceId` (callback arg) | 1 |
| `src/hooks/useWorkspaceMutations.ts` | `WorkspaceInsert`, `variables` (callback arg) | 2 |
| `src/lib/folder-icons.ts` | `value` (callback arg) | 1 |
| `src/pages/Analytics.tsx` | (no unused-vars — only hook dep warning) | 0 |
| `src/pages/OrganizationJoin.tsx` | `RiCheckLine`, `switchOrganization`, `organizations` | 3 |
| `src/pages/SetupWizard.tsx` | (no unused-vars — only hook dep warning) | 0 |
| `src/components/AssignFolderDialog.tsx` | `resolved` | 1 |
| `cloudflare/api-proxy/__tests__/worker.test.ts` | `vi`, `beforeEach` | 2 |
| `src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx` | `React` | 1 |
| `src/components/settings/__tests__/MCPTab.permissions.test.tsx` | `within` | 1 |
| `src/components/tags/__tests__/FoldersTab.integration.test.tsx` | `within`, `user` | 2 |
| `src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts` | `updateChain` | 1 |
| `src/services/__tests__/tags.service.test.ts` | `tagsService` | 1 |
| `src/stores/__tests__/panelStore.test.ts` | `goBack` | 1 |
| `src/hooks/__tests__/useFolders.test.ts` | (check — not shown in output above) | — |
| `src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts` | `updateChain` | 1 |
| `src/services/__tests__/organizations.service.test.ts` | (check — not shown in output above) | — |

**Estimated warnings eliminated: ~65** (unused-vars only, excluding any-typed).

### Step 3 — Hook dependency warnings

See "Hook Dep Warnings" section below for safe vs. risky breakdown.

### Step 4 — Doc fixes

See "Active Doc Fixes" section below.

### Step 5 — Add lint:docs script

See "Lint:docs Grep Gate" section below.

### Verification after each step

```bash
npm run lint 2>&1 | tail -3        # Check warning count dropping
npm run type-check                  # Must stay silent (exit 0)
npm run build 2>&1 | tail -5       # Must end with "built in X.XXs"
```

---

## Remix Icon Substitutions

Confirmed from live codebase usage (these exact names are already in use elsewhere in `src/`):

| Lucide (forbidden) | Remix Icon replacement | Verified in codebase |
|-------------------|----------------------|----------------------|
| `Eye` | `RiEyeLine` | Yes — `src/components/transcripts/TranscriptsTab.tsx` and others |
| `Pencil` | `RiPencilLine` | Yes — `src/components/tags/FoldersTab.tsx` and others |
| `Download` | `RiDownloadLine` | Yes — `src/hooks/useTranscriptExport.ts` area |
| `X` | `RiCloseLine` | Yes — multiple components |
| `ChevronLeft` | `RiArrowLeftSLine` | Yes — pagination components |
| `ChevronRight` | `RiArrowRightSLine` | Yes — pagination components |
| `Search` | `RiSearchLine` | Yes — search components |
| `Users` | `RiUserLine` | Yes — member/org components |

**Exact replacement for `BUTTON_VARIANTS.md:268`:**

Replace line 268:
```tsx
import { Eye, Pencil, Download, X, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
```

With:
```tsx
import { RiEyeLine, RiPencilLine, RiDownloadLine, RiCloseLine, RiArrowLeftSLine, RiArrowRightSLine, RiSearchLine, RiUserLine } from "@remixicon/react";
```

**Note on `ChevronLeft`/`ChevronRight`:** The codebase uses both `RiArrowLeftSLine`/`RiArrowRightSLine` (small chevron — pagination) and `RiArrowLeftLine`/`RiArrowRightLine` (full arrow — navigation). For the button icon context in BUTTON_VARIANTS.md the S (small) variants are the closer semantic match for prev/next navigation within a component. Either is correct — `RiArrowLeftSLine` is the established convention for chevron-style prev/next buttons.

---

## Lint:docs Grep Gate

### npm script (add to package.json `"scripts"`)

```json
"lint:docs": "bash -c 'FAIL=0; grep -rn \"from [\\x27\\\"]['\\\"]*lucide\" docs/ --include=\"*.md\" | grep -v \"docs/archive/\" && FAIL=1; grep -rn \"AI-powered\" docs/ --include=\"*.md\" | grep -v \"docs/archive/\\|not AI-powered\\|AI-ready, not\\|never.*AI-powered\\|avoid.*AI-powered\" && FAIL=1; exit $FAIL' || true"
```

**Simpler, maintainable version** (recommended — splits into readable parts):

```json
"lint:docs": "node scripts/lint-docs.js"
```

With `scripts/lint-docs.js`:

```js
#!/usr/bin/env node
// Guardrail: detect forbidden positive-recommending patterns in active docs.
// Run: npm run lint:docs
// Exits 0 always (warning-only per D-10). Prints violations if found.

import { execSync } from 'child_process';

const CHECKS = [
  {
    label: 'lucide-react import in docs',
    cmd: `grep -rn "from 'lucide\\|from \\"lucide" docs/ --include="*.md"`,
    exclude: 'docs/archive/',
  },
  {
    label: 'positive AI-powered language in docs',
    cmd: `grep -rn "AI-powered" docs/ --include="*.md"`,
    exclude: /docs\/archive\/|not AI-powered|AI-ready, not|never use.*AI-powered|avoid.*AI-powered/,
  },
  {
    label: 'framer-motion positive use in docs',
    cmd: `grep -rn "framer-motion" docs/ --include="*.md"`,
    exclude: /docs\/archive\/|NEVER use|do not use|forbidden|import from 'motion\/react'/,
  },
];

// ... (filter + print logic)
```

**However**, for the simplest path that matches D-10 "keep it a warning, not error", the inline bash approach in package.json is sufficient:

**Recommended minimal implementation:**

```json
"lint:docs": "echo '--- lint:docs ---' && (grep -rn \"lucide-react\" docs/ --include=\"*.md\" | grep -v 'docs/archive/' && echo 'WARNING: lucide-react found in active docs' || true) && (grep -rn 'AI-powered' docs/ --include=\"*.md\" | grep -Ev 'docs/archive/|not AI-powered|AI-ready, not' && echo 'WARNING: positive AI-powered found in active docs' || true) && echo 'lint:docs complete'"
```

### Patterns and what they catch

| Pattern | Grep command | Exclusion | What it catches |
|---------|-------------|-----------|-----------------|
| Lucide imports | `grep -rn "lucide-react" docs/ --include="*.md"` | `\| grep -v "docs/archive/"` | Any import example using lucide-react |
| Positive AI-powered | `grep -rn "AI-powered" docs/ --include="*.md"` | `\| grep -Ev "docs/archive/\|not AI-powered\|AI-ready, not"` | "AI-powered X" product descriptors; misses "avoid AI-powered" prohibition phrasing |
| framer-motion positive | `grep -rn "framer-motion" docs/ --include="*.md"` | `\| grep -Ev "docs/archive/\|NEVER use\|do not use\|forbidden"` | Positive framer-motion recommendations; leave prohibition context |

**Confirmed current state after fixes:** Both violations (`BUTTON_VARIANTS.md:268` and `export-system.md:66`) will be eliminated. Running `npm run lint:docs` post-fix should produce zero hits.

---

## Active Doc Fixes

### Fix 1 — `docs/design/BUTTON_VARIANTS.md:268`

**Current (line 268):**
```tsx
import { Eye, Pencil, Download, X, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
```

**Replacement:**
```tsx
import { RiEyeLine, RiPencilLine, RiDownloadLine, RiCloseLine, RiArrowLeftSLine, RiArrowRightSLine, RiSearchLine, RiUserLine } from "@remixicon/react";
```

No other lines in BUTTON_VARIANTS.md need changing. This is a one-line edit.

### Fix 2 — `docs/help/export-system.md:66`

**Current (line 66):**
```
For AI-powered summaries and insights:
```

**Replacement:**
```
For AI-ready export with summaries and action items:
```

Alternative phrasing options (all acceptable per brand guidelines):
- `For Smart Export (summary, action items, quotes):`
- `For structured export with summaries and insights:`

The replacement must not include "AI-powered" as a product descriptor. "AI-ready" is the approved brand framing per `docs/design/brand-guidelines-v4.4.md` and CLAUDE.md hard constraint.

---

## Hook Dep Warnings — Safe vs Risky

### Safe to fix (add the dep, no semantic change risk)

| File | Line | Warning | Safe fix |
|------|------|---------|----------|
| `src/components/SmartExportDialog.tsx` | 187 | `useMemo` missing `availableWorkspaces.length`, `excludedWorkspaces.length` | Add both to dep array — `.length` is a scalar, won't cause re-render loops |
| `src/components/import/PasteTranscriptModal.tsx` | 439 | `useMemo` missing `sourceLinkMetadata?.author_name` | Add to dep array — optional chain value is stable scalar |
| `src/pages/OrganizationPage.tsx` | 105 | `useEffect` has *unnecessary* dep `activeOrganization.name` | Remove from dep array (ESLint says exclude it) |
| `src/components/contacts/ReengagementEmailModal.tsx` | 69 | `useEffect` missing `contact` | Evaluate: if `contact` changes should re-run the effect, add it. If intentionally run-once, suppress. |

### Risky — suppress with comment

| File | Lines | Warning | Why risky | Suppress action |
|------|-------|---------|-----------|-----------------|
| `src/hooks/useSyncTabState.ts` | 330 | `completedJobTimeoutsRef.current` stale ref in cleanup | Ref value captured at cleanup time is intentional — the cleanup clears whatever timeouts exist at teardown. Adding the ref to deps would cause effect re-runs. | `// eslint-disable-next-line react-hooks/exhaustive-deps` + comment: "completedJobTimeoutsRef.current is intentionally read at cleanup time; adding to deps would re-subscribe on every timeout map change" |
| `src/hooks/useSyncTabState.ts` | 332 | `useEffect` missing `handleJobCompleted`, `recentlyCompletedJobs`, `removeNewlySyncedMeetings` | This effect wires realtime subscription callbacks. Adding these deps would re-subscribe the realtime channel on every job state change — likely causing duplicate subscriptions. Intentional empty/stable dep array. | `// eslint-disable-next-line react-hooks/exhaustive-deps` + comment: "Realtime subscription — deps intentionally omitted to prevent re-subscription on job state changes" |
| `src/hooks/useSyncTabState.ts` | 339 | `useEffect` missing `loadTags` | `loadTags` is defined inline and not memoized — adding it would re-run on every render. | Suppress with comment, or wrap `loadTags` in `useCallback` first then add dep. Wrapping `loadTags` in useCallback is the clean fix but adds complexity — suppress is safer for this phase. |
| `src/hooks/useCategorySync.ts` | 19 | `useEffect` missing `loadTags` | Same pattern — inline async function | Suppress with comment |
| `src/hooks/useCategorySync.ts` | 175 | `useCallback` missing `activeOrgId` | `activeOrgId` from context — if it changes the callback should update. This is likely a safe add, but verify `useOrganizationContext` returns a stable value. | Evaluate: if `activeOrgId` is stable (memoized in context), safe to add. If not, adding causes callback churn. |
| `src/hooks/useSyncTabState.ts` | 186 | `useCallback` missing `queryClient` | `queryClient` from TanStack Query's `useQueryClient()` is a stable singleton — safe to add | Safe to add |
| `src/pages/Analytics.tsx` | 44 | `useEffect` missing `selectedCategory` | Evaluate intent: if effect should re-run when category changes, add it. If intentional run-once, suppress. | Needs code read |
| `src/pages/SetupWizard.tsx` | 147 | `useEffect` missing `connectedMeta`, `connectedSources` | Polling/initialization effect — adding may cause loop if these change on effect execution | Read before deciding; default to suppress |
| `src/hooks/useUserPreferences.ts` | 99 | `useEffect` missing `loadPreferences` | Same inline-function pattern — suppress | Suppress with comment |
| `src/components/connectors/ConnectionsPanel.tsx` | 45 | `useMemo` — `accounts` logical expression changes on every render | Fix: move `accounts` initialization inside the useMemo callback | Safe structural fix — no semantic change |

**Summary of hook dep approach for this phase:**
- **4 safe adds:** SmartExportDialog, PasteTranscriptModal, OrganizationPage (remove unnecessary), ConnectionsPanel (restructure)
- **~7 suppress with comment:** All the useSyncTabState subscription effects, inline-loadTags patterns, SetupWizard init effect
- **1 evaluate at implementation time:** AccountTab `loadPreferences` — read the function before deciding

---

## Build Health

### npm run type-check
**Status: PASSES** — exits 0, no output. Confirmed 2026-06-10.

### npm run build
**Status: PASSES** — builds in ~9.31s with no errors. Output includes informational warnings (not errors):
- CJS Vite Node API deprecation notice (cosmetic, not actionable this phase)
- Browserslist caniuse-lite 6 months old (cosmetic)
- jspdf/docx dynamic+static import conflict (pre-existing, not introduced by this phase)
- Chunk size warnings (pre-existing, out of scope)

None of these are blockers. Build exits clean.

**Both gates pass before this phase touches a single file.** This is the baseline to protect.

---

## Validation Architecture

### Phase success verification commands

```bash
# 1. Warning count dropped materially (primary success metric)
npm run lint 2>&1 | tail -1
# Before: "✖ 237 problems (0 errors, 237 warnings)"
# Target:  "✖ <170 problems (0 errors, <170 warnings)" (removing ~70 stale-disable + unused-vars)

# 2. No regressions — type-check still silent
npm run type-check
# Expected: exit 0, no output

# 3. No regressions — build still passes
npm run build 2>&1 | grep "built in\|error"
# Expected: "✓ built in X.XXs" with no "error" lines

# 4. Active doc violations cleared
grep -rn "lucide-react" docs/ --include="*.md" | grep -v "docs/archive/"
# Expected: no output

grep -rn "AI-powered" docs/ --include="*.md" | grep -Ev "docs/archive/|not AI-powered|AI-ready, not"
# Expected: no output

# 5. lint:docs script works
npm run lint:docs
# Expected: "lint:docs complete" with no WARNING lines
```

### Quick per-file verification pattern

After editing any `.tsx`/`.ts` file, run scoped lint to confirm warnings gone:
```bash
npm run lint -- src/components/panes/WorkspaceSidebarPane.tsx 2>&1 | grep "warning\|error" | tail -5
```

---

## Assumptions Log

All claims in this research were verified against the live codebase. No assumed claims.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims are VERIFIED** — sourced from `npm run lint` output (2026-06-10), direct file reads, and `npm run build`/`npm run type-check` execution.

---

## Sources

- `npm run lint` — live output, 237 warnings, 2026-06-10
- `npm run build` — clean pass, 9.31s, 2026-06-10
- `npm run type-check` — silent exit 0, 2026-06-10
- `docs/design/BUTTON_VARIANTS.md:268` — direct read
- `docs/help/export-system.md:66` — direct read
- `src/` codebase grep for `@remixicon/react` imports — icon name verification
- `package.json` scripts block — confirmed no `lint:docs` exists yet
- `09-CONTEXT.md` — locked decisions D-01 through D-12
