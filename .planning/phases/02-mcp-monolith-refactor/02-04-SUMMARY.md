---
phase: 02-mcp-monolith-refactor
plan: 04
subsystem: backend
tags: [mcp, edge-functions, registry, read-tools, vitest]

requires:
  - phase: 02-mcp-monolith-refactor
    provides: Protocol/auth/gating helpers and pilot read-tool registry extraction
provides:
  - All 17 read-category MCP tools live under tools/read/
  - Registry dispatch covers the complete read category
  - Golden replay and boundary anchors follow extracted read modules
affects: [mcp-server, phase-02, phase-05]

tech-stack:
  added: []
  patterns: [ToolModule, registry-dispatch, source-anchor-tests]

key-files:
  created:
    - supabase/functions/mcp-server/tools/read/list_contacts.ts
    - supabase/functions/mcp-server/tools/read/get_contact.ts
    - supabase/functions/mcp-server/tools/read/get_contact_calls.ts
    - supabase/functions/mcp-server/tools/read/list_folders.ts
    - supabase/functions/mcp-server/tools/read/get_folder_calls.ts
    - supabase/functions/mcp-server/tools/read/list_tags.ts
    - supabase/functions/mcp-server/tools/read/get_tagged_calls.ts
    - supabase/functions/mcp-server/tools/read/list_speakers.ts
    - supabase/functions/mcp-server/tools/read/get_speaker_calls.ts
    - supabase/functions/mcp-server/tools/read/get_action_items.ts
    - supabase/functions/mcp-server/tools/read/get_call_notes.ts
    - supabase/functions/mcp-server/tools/read/list_shared_calls.ts
  modified:
    - supabase/functions/mcp-server/index.ts
    - supabase/functions/mcp-server/tools/registry.ts
    - supabase/functions/mcp-server/__tests__/golden-replay.test.ts
    - supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts
    - src/components/connectors/__tests__/ConnectorImportWizard.test.tsx
    - .planning/config.json

key-decisions:
  - "Kept read module definitions as name-only overlays so tools/list continues to use the original TOOLS order and schemas."
  - "Moved get_call_notes test anchors to the extracted module file instead of weakening the PII boundary tests."
  - "Set workflow.use_worktrees=false for Codex because this runtime cannot honor GSD worktree isolation."

patterns-established:
  - "Read tools are extracted one file per tool with category: read and the existing ToolModule handler contract."
  - "Static source-anchor tests can resolve both remaining index switch cases and extracted module files."

requirements-completed: [MCP-05]

duration: 13 min
completed: 2026-05-28
---

# Phase 02 Plan 04: Remaining Read Tool Extraction Summary

**Complete read-category MCP module extraction with preserved markdown responses, scope boundaries, and registry coverage**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-28T08:50:00Z
- **Completed:** 2026-05-28T09:03:04Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Extracted the remaining 12 read tools into `supabase/functions/mcp-server/tools/read/`, bringing the read module count to 17/17.
- Removed every read `case` block from `mcp-server/index.ts`; the inline switch now starts with AI/write/admin tools.
- Registered the complete read category in `tools/registry.ts` without changing `TOOLS` definition order.
- Updated golden replay and `get_call_notes` PII boundary anchors so tests follow extracted modules.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract contacts, folders, and tags read modules** - `73c8879b` (refactor)
2. **Task 2: Extract speaker, action-item, notes, and shared-call read modules** - `88290c31` (refactor)

Supporting commits:

- **Codex sequential execution config** - `abb950f9` (chore)
- **Post-merge test harness repair** - `a749ed10` (test)

## Files Created/Modified

- `supabase/functions/mcp-server/tools/read/*.ts` - Complete read tool module set for all 17 read tools.
- `supabase/functions/mcp-server/index.ts` - Removed 707 lines of read-tool switch cases while preserving dispatcher order.
- `supabase/functions/mcp-server/tools/registry.ts` - Registers every read tool module.
- `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` - Maps all extracted read tools to source modules for handler anchors.
- `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` - Resolves `get_call_notes` anchors from the extracted module.
- `src/components/connectors/__tests__/ConnectorImportWizard.test.tsx` - Refreshed stale setup-cluster mocks so the full test suite can render current connector setup UI.
- `.planning/config.json` - Disables GSD worktree mode for Codex runtime.

## Decisions Made

- Kept the module `definition` fields as `{ name }` overlays because `buildToolDefinitions()` intentionally preserves the legacy `TOOLS` schema, outputSchema, and ordering.
- Treated the full-suite `ConnectorImportWizard` failure as a blocking stale test harness issue, not a production-code dependency of this MCP plan.
- Preserved `get_action_items` as a read tool even though the surrounding monolith comment labels the next block as AI features; the canonical category map classifies it as read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Configured Codex sequential execution**
- **Found during:** Execute-phase initialization
- **Issue:** GSD's Codex runtime gate fails closed unless `workflow.use_worktrees=false`; Codex cannot honor Claude worktree isolation.
- **Fix:** Set and committed `.planning/config.json` `workflow.use_worktrees=false`.
- **Files modified:** `.planning/config.json`
- **Verification:** Execute-phase proceeded in direct-main sequential mode.
- **Committed in:** `abb950f9`

**2. [Rule 3 - Blocking] Repaired stale connector import wizard test mocks**
- **Found during:** Post-merge `npm test`
- **Issue:** `ConnectorImportWizard.test.tsx` mocked `useWorkspaces` but the setup cluster now renders `DefaultDestinationBar`, which expects newer destination-routing dependencies.
- **Fix:** Mocked `DefaultDestinationBar` in this test file and added the current workspace hook export to the existing mock.
- **Files modified:** `src/components/connectors/__tests__/ConnectorImportWizard.test.tsx`
- **Verification:** `npm test -- --run src/components/connectors/__tests__/ConnectorImportWizard.test.tsx` and full `npm test` pass.
- **Committed in:** `a749ed10`

---

**Total deviations:** 2 auto-fixed (blocking workflow/test gate issues).  
**Impact on plan:** No MCP behavior scope was broadened. The extra frontend test change only restored the existing test harness so the repo-level gate could pass.

## Issues Encountered

- Initial full `npm test` failed with 8 stale `ConnectorImportWizard.test.tsx` mock errors. Fixed and reran successfully.
- Vite build emitted existing chunk-size and mixed static/dynamic import warnings for `jspdf` and `docx`; build exited 0.

## Verification

- `npm test -- --run supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts` - 32 passed.
- `npm test -- --run supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts supabase/functions/mcp-server/__tests__/contract-surface.test.ts supabase/functions/mcp-server/__tests__/golden-replay.test.ts supabase/functions/mcp-server/__tests__/category-gating.test.ts` - 80 passed.
- `npm run build` - passed.
- `npm test` - 153 files passed, 5 skipped; 1397 tests passed, 69 skipped.
- `rg "case '(search_calls|list_calls|get_transcript|get_recording_context|list_workspaces|list_contacts|get_contact|get_contact_calls|list_folders|get_folder_calls|list_tags|get_tagged_calls|list_speakers|get_speaker_calls|get_action_items|get_call_notes|list_shared_calls)'" supabase/functions/mcp-server/index.ts` - no matches.
- `rg "category: 'read'" supabase/functions/mcp-server/tools/read | wc -l` - 17.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-05 can now extract the existing write tools against the registry pattern. The read side is complete, and `index.ts` is down to 2,518 lines with only AI/write/admin inline switch cases remaining.

---
*Phase: 02-mcp-monolith-refactor*
*Completed: 2026-05-28*
