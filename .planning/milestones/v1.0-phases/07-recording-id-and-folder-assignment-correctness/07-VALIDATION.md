---
phase: 07
slug: recording-id-and-folder-assignment-correctness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --reporter=verbose src/services/folders` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (unit), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check` (zero tolerance for TS errors)
- **After service layer changes:** Run `npm test -- src/services/folders`
- **After filter layer changes:** Run `npm test -- src/services/transcript-filters`
- **End of each wave:** Run `npm test` (full suite, all 1501 tests must stay green)

---

## Validation Architecture

### Wave 0: Baseline confirmation
- Confirm `npm test` passes before any edits
- Note current failing tests (if any) as pre-existing

### Wave 1: Service layer (UUID-aware write path)
- Unit: `folders.service.ts` — `assignRecordingToFolder` routes UUID vs BIGINT correctly
- Unit: `useFolderAssignment` hooks — widened `string | number` types accepted
- Type check: `npm run type-check` passes after type widening

### Wave 2: Read/filter layer
- Unit: `getRecordingIdsForFolderFilter` returns UUID-sourced recordings in named folder results
- Unit: `getAssignedFolderLegacyRecordingIds` correctly excludes UUID recordings from "unorganized"
- Integration (if `VITEST_INTEGRATION_OK=true`): UUID assign → filter → retrieve round-trip

### Wave 3: UI layer
- Type check: `AssignFolderDialog` and `DndCallProvider` compile without errors
- Manual: Assign a non-Fathom recording to a folder via dialog — no false success toast
- Manual: Drag a non-Fathom recording to a folder in TranscriptsTab

### Phase Gate
- `npm test` green (all 1501+ tests pass)
- `npm run type-check` zero errors
- `npm run build` succeeds
- Browser walkthrough: assign canonical UUID recording to a folder
