---
phase: 11-org-segregation-4-pane
plan: "01"
subsystem: api
tags: [supabase, typescript, tanstack-query, org-scoping, security]

# Dependency graph
requires: []
provides:
  - "Explicit organization_id filtering on getImportCounts and getFailedImports"
  - "Explicit organization_id filtering on getRecordingById and getRecordingByLegacyId"
  - "useImportCounts and useFailedImports pass activeOrgId with proper cache keys"
  - "getTagCounts filters call_tag_assignments via org-scoped tag IDs"
  - "getTagRules filters tag_rules via org-scoped tag IDs"
  - "useTagCounts and useTagRules gated on !!orgId"
  - "ORG-02 filter pipeline audit comment in FilterBar.tsx"
  - "Org-scoping assumption comments in workspace-entries and raw-calls services"
affects: [12-import-flows, 13-wiring-and-filters, 16-filters-and-sort]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defense-in-depth: explicit org_id filter on all recording detail fetches, even with RLS"
    - "Indirect org scoping via tag IDs for tables without organization_id column"
    - "All hooks dependent on org context use enabled: !!activeOrgId"
    - "activeOrgId included in TanStack Query keys for cache scoping on org switch"

key-files:
  created: []
  modified:
    - "src/services/import-sources.service.ts"
    - "src/services/recordings.service.ts"
    - "src/services/workspace-entries.service.ts"
    - "src/services/raw-calls.service.ts"
    - "src/services/tags.service.ts"
    - "src/hooks/useImportSources.ts"
    - "src/hooks/useTags.ts"
    - "src/components/transcript-library/FilterBar.tsx"
    - "src/pages/CallDetailPage.tsx"

key-decisions:
  - "getImportCounts switched from RPC to direct query to support org filter (RPC only accepted user_id)"
  - "getFailedImports scopes the synced-check by org via .eq('organization_id', organizationId) on recordings join"
  - "getTagCounts uses indirect org filter: fetch org tag IDs then .in('tag_id', orgTagIds) on assignments"
  - "getTagRules uses .or() filter combining org tag IDs and null tag_id (folder-only rules exposed via RLS)"
  - "raw-calls and workspace-entries rely on indirect org isolation (recordingId from caller must be org-scoped)"

patterns-established:
  - "Pattern: defense-in-depth org filter — add .eq('organization_id', orgId) even when RLS covers it"
  - "Pattern: tables without organization_id column — filter via parent entity FK (tag_id → call_tags.organization_id)"
  - "Pattern: hooks with org dependency — enabled: !!activeOrgId prevents queries before org context initialized"

requirements-completed: [ORG-01, ORG-02, ORG-05]

# Metrics
duration: 5min
completed: "2026-03-30"
---

# Phase 11 Plan 01: Org Segregation Service Layer Summary

**Explicit organization_id filtering added to all service-layer queries — import counts, recording detail, tag counts, tag rules — with connected accounts remaining user-scoped per ORG-05**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T20:55:54Z
- **Completed:** 2026-03-30T21:00:45Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- All recording detail fetches (by UUID and legacy ID) now explicitly filter by organization_id — defense-in-depth beyond RLS
- Import counts and failed imports scoped to current org; hooks updated with activeOrgId in query keys and enabled guards
- Tag count and tag rule queries fixed from `void orgId` to actual org filtering via indirect tag ID lookups
- ORG-02 audit trail documented in FilterBar.tsx covering all 5 filter popover data pipelines

## Task Commits

1. **Task 1: Add org_id filtering to import-sources and recordings services** - `ab16629a` (feat)
2. **Task 2: Wire activeOrgId into import hooks and document workspace-entries/raw-calls scoping** - `e9981a16` (feat)
3. **Task 3: Fix filter popover org scoping — tag counts, tag rules, audit comment** - `03abe241` (feat)

## Files Created/Modified

- `src/services/import-sources.service.ts` - getImportCounts now accepts organizationId and queries recordings directly; getFailedImports scopes synced-check by org; getImportSources gets ORG-05 comment
- `src/services/recordings.service.ts` - getRecordingById and getRecordingByLegacyId signatures updated to require organizationId param with .eq filter
- `src/services/workspace-entries.service.ts` - Added comment documenting org-scoped-recordingIds assumption (no org_id column on workspace_entries)
- `src/services/raw-calls.service.ts` - Added comment documenting indirect org isolation via recording fetch
- `src/services/tags.service.ts` - getTagCounts and getTagRules fixed from void orgId to actual org filtering via tag ID subsets
- `src/hooks/useImportSources.ts` - useImportCounts and useFailedImports pass activeOrgId from useOrgContext, include it in query keys, enabled: !!activeOrgId
- `src/hooks/useTags.ts` - useTagCounts and useTagRules now have enabled: !!orgId
- `src/components/transcript-library/FilterBar.tsx` - Added ORG-02 audit comment documenting all filter pipelines
- `src/pages/CallDetailPage.tsx` - Updated to pass activeOrgId to getRecordingById/getRecordingByLegacyId calls

## Decisions Made

- **getImportCounts switched from RPC to direct query**: The `get_import_counts` RPC only accepts `p_user_id` and returns cross-org totals. Switched to a direct `recordings` query with `.eq('organization_id', organizationId)` so counts reflect only the current org.
- **getTagCounts uses indirect org filtering**: `call_tag_assignments` has no `organization_id` column. Solution: fetch org's tag IDs from `call_tags` (which HAS `organization_id`) then `.in('tag_id', orgTagIds)` on assignments.
- **getTagRules uses .or() with null tag_id**: `tag_rules` has no `organization_id` column. Rules are filtered by org tag IDs plus `tag_id IS NULL` (folder-only rules) which are user-scoped via RLS — safest approach without a DB migration.
- **raw-calls and workspace-entries: comment-only**: These tables have no `organization_id` and the org isolation is indirect (caller provides org-scoped recordingIds). Adding comments is sufficient and correct — the recording detail fetch already ensures org scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CallDetailPage was calling getRecordingById/getRecordingByLegacyId without organizationId**
- **Found during:** Task 1 (updating recordings.service.ts signatures)
- **Issue:** After changing function signatures to require organizationId, the call site in CallDetailPage.tsx was now a TypeScript error. The plan specified adding the parameter to the service functions but didn't explicitly list CallDetailPage.tsx as a file to update.
- **Fix:** Added `useOrgContext` import to CallDetailPage, destructured `activeOrgId`, passed it to both recording fetch calls, updated `enabled` to also gate on `!!activeOrgId`
- **Files modified:** `src/pages/CallDetailPage.tsx`
- **Verification:** TypeScript compiled with 0 errors after fix
- **Committed in:** `ab16629a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for TypeScript compilation and correctness. Exactly in scope.

## Issues Encountered

- `tag_rules` table has no `organization_id` column — the original plan assumed one might exist or suggested a join approach. Used indirect tag-ID filtering as the correct alternative. No DB migration needed for this plan's scope.
- `sync_jobs` table has no `organization_id` column — scoped the "already synced" recording check by org instead (defense-in-depth via the recordings join).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Service layer org isolation is complete for all queried entities covered by this plan
- Phase 12 (Import Flows) and Phase 13 (Wiring and Filters) can proceed with confidence that underlying data queries are org-safe
- Future plans touching recordings detail, tag data, or import counts should pass `activeOrgId` as a first-class parameter — pattern established

---
*Phase: 11-org-segregation-4-pane*
*Completed: 2026-03-30*
