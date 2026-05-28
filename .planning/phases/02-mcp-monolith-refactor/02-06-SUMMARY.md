---
phase: 02-mcp-monolith-refactor
plan: 06
subsystem: backend
tags: [mcp, edge-functions, registry, admin-tools, vitest]

requires:
  - phase: 02-mcp-monolith-refactor
    provides: Complete write-tool registry extraction and dispatcher pattern
provides:
  - All 8 current admin-category MCP tools live under tools/admin/
  - Registry dispatch covers the complete admin category
  - Category, contract, and golden replay tests follow extracted admin modules
affects: [mcp-server, phase-02, phase-03, phase-04]

tech-stack:
  added: []
  patterns: [ToolModule, registry-dispatch, admin-category-modules, source-anchor-tests]

key-files:
  created:
    - supabase/functions/mcp-server/tools/admin/create_folder.ts
    - supabase/functions/mcp-server/tools/admin/rename_folder.ts
    - supabase/functions/mcp-server/tools/admin/delete_folder.ts
    - supabase/functions/mcp-server/tools/admin/create_tag.ts
    - supabase/functions/mcp-server/tools/admin/rename_tag.ts
    - supabase/functions/mcp-server/tools/admin/delete_tag.ts
    - supabase/functions/mcp-server/tools/admin/create_organization.ts
    - supabase/functions/mcp-server/tools/admin/create_workspace.ts
  modified:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/tools/registry.ts
    - supabase/functions/mcp-server/__tests__/contract-surface.test.ts
    - supabase/functions/mcp-server/__tests__/golden-replay.test.ts

key-decisions:
  - "Kept admin module definitions as name-only overlays so tools/list keeps the legacy TOOLS schemas and ordering."
  - "Preserved existing folder, tag, organization, and workspace handler behavior while moving each case body into a ToolModule."
  - "Added source-anchor coverage for all admin modules in the contract surface test instead of importing Deno modules into Vitest."

patterns-established:
  - "Admin tools are extracted one file per tool with category: admin and the existing ToolModule handler contract."
  - "Contract tests assert admin tool files, category markings, and registry inclusion as a family-level guard."

requirements-completed: [MCP-05]

duration: 10 min
completed: 2026-05-28
---

# Phase 02 Plan 06: Admin Tool Extraction Summary

**Complete admin-category MCP module extraction with preserved destructive behavior and category gating**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-28T13:52:54Z
- **Completed:** 2026-05-28T13:58:32Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Extracted all 8 current admin tools into `supabase/functions/mcp-server/tools/admin/`.
- Removed admin `case` blocks from `mcp-server/index.ts`; the inline switch now retains only the remaining AI cases and default fallback.
- Registered every admin module in `tools/registry.ts` with `category: 'admin'`.
- Added contract coverage proving the admin files, category markings, and registry symbols stay complete.
- Updated golden replay anchoring so the admin fixture follows the extracted `create_folder` module.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract folder and tag admin tools** - `6cd7f560` (feat)
2. **Task 2: Extract organization and workspace admin tools** - `6cd7f560` (feat)

## Files Created/Modified

- `supabase/functions/mcp-server/tools/admin/*.ts` - Complete current admin tool module set for folder, tag, organization, and workspace administration.
- `supabase/functions/mcp-server/index.ts` - Removed current admin-tool switch cases while preserving remaining AI fallback cases.
- `supabase/functions/mcp-server/tools/registry.ts` - Registers every current admin tool module.
- `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - Asserts all eight admin modules exist, export `category: 'admin'`, and are included in the registry.
- `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` - Maps `create_folder` to the extracted admin module for replay fixture anchoring.

## Decisions Made

- Kept admin handlers behavior-preserving and moved the existing case bodies directly into modules.
- Kept the legacy `TOOLS` array in `index.ts` as the schema/order source for `tools/list`; admin modules provide name overlays through the registry.
- Did not add Phase 3 connection-management or Phase 4 write-tool behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added golden replay extracted path for create_folder**
- **Found during:** Plan-level verification
- **Issue:** `golden-replay.test.ts` could not locate the `create_folder` fixture handler after its switch case moved.
- **Fix:** Mapped `create_folder` to `tools/admin/create_folder.ts`.
- **Files modified:** `supabase/functions/mcp-server/__tests__/golden-replay.test.ts`
- **Verification:** Full plan MCP test set passes.
- **Committed in:** `6cd7f560`

---

**Total deviations:** 1 auto-fixed test-anchor update.  
**Impact on plan:** No MCP behavior scope was broadened; the change keeps replay tests aligned with the modular extraction.

## Issues Encountered

- Plan-level verification initially failed only because golden replay had not yet been taught the extracted `create_folder` path.
- Vite build emitted existing chunk-size and mixed static/dynamic import warnings for `jspdf` and `docx`; build exited 0.

## Verification

- `npm test -- --run supabase/functions/mcp-server/__tests__/category-gating.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts` - 27 passed.
- `npm test -- --run supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts` - initially failed on missing `create_folder` extracted path, then passed with 33 tests.
- `npm run build` - passed before commit.
- `npm run build` - passed after commit against committed source state.
- `rg "case '(create_folder|rename_folder|delete_folder|create_tag|rename_tag|delete_tag|create_organization|create_workspace)'" supabase/functions/mcp-server/index.ts` - no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-07 can now extract the remaining AI tools. Read, write, and admin categories are modular; `index.ts` retains AI inline cases for the final extraction slice before Plan 02-08 cleanup and live/cold-start verification.

---
*Phase: 02-mcp-monolith-refactor*
*Completed: 2026-05-28*
