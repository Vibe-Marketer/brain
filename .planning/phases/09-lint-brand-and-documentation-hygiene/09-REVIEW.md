---
phase: 09-lint-brand-and-documentation-hygiene
status: issues-found
depth: standard
files_reviewed: 10
findings:
  critical: 2
  warning: 6
  info: 2
  total: 10
---

# Code Review — Phase 09: lint-brand-and-documentation-hygiene

Focus: Plan 09-04 react-hooks/exhaustive-deps fixes — correctness of dep arrays, stale closure risks.

## Critical / Blocker Findings

### CR-01 — Real Stale-Closure Bug (`useSyncTabState.ts`)

`recentlyCompletedJobs` is plain state read inside a mount-time closure. The `alreadyHandled` check always evaluates against the empty array from mount — every poll tick after the first job completes calls `handleJobCompleted` again, causing duplicate refreshes, banners, and query invalidations.

**Fix:** Mirror ref: `const recentlyCompletedJobsRef = useRef(recentlyCompletedJobs)` + effect to sync it; use `.current` inside the poll closure.

### CR-02 — Component Declared Inside Render Body (`OrganizationPage.tsx`)

`OverviewContent` is declared inside the parent render body. React creates a new component type on every re-render, destroying inner state (`isSaving`, `deletingOrg`, org name field) whenever `selectedCategory` changes. The dep suppression comment explains the wrong problem.

**Fix:** Hoist `OverviewContent` outside `OrganizationPage`, pass props explicitly.

## Warning Findings

### WR-01 — Stale Override Values (`PasteTranscriptModal.tsx`)
Metadata-fetch effect reads `titleOverride`/`dateOverride`/`summaryOverride` from stale closure — user-edited values silently overwritten when source URL changes.

### WR-02 — Weak Attendees Dep (`PasteTranscriptModal.tsx`)
`parsed.attendees.length` misses same-count-different-names changes. Use `parsed.attendees.join(',')`.

### WR-03 — `loadTags` Stale Org Scope (`useCategorySync.ts`)
`loadTags` closes over `activeOrgId` but isn't memoized or in dep array — manual callers get stale org scope after org switch.

### WR-04 — Concurrent-Mode Race (`Analytics.tsx`)
Two effects on shared state with suppressed deps create a React 18 race: back/forward navigation can trigger both in the same batch, causing spurious `navigate()` with stale `selectedCategory`.

### WR-05 — Same Stale Pattern (`useSyncTabState.ts`)
`loadTags`/`activeOrgId` stale pattern — tags won't reload on org switch.

### WR-06 — Stale `connectedSources` in OAuth Merge (`SetupWizard.tsx`)
OAuth return merge uses closed-over `connectedSources` instead of `saved?.connectedSources` — previously-connected source can vanish from setup status header.

## Info Findings

### IN-01 — No-op `eslint-disable-line` on Cleanup Code
ESLint doesn't fire on cleanup return functions; comment is a no-op.

### IN-02 — Wrong Suppression Comment (`ReengagementEmailModal.tsx`)
Suppression comment describes the wrong dep pattern.

## Summary

Plans 01–03 (stale directive removal, doc fixes, unused-var renames) are clean. Plan 09-04 introduced 2 real bugs (stale poll closure, component-in-render-body) that warrant fixes before shipping the phase. 6 warnings are correctness risks worth a follow-up pass.
