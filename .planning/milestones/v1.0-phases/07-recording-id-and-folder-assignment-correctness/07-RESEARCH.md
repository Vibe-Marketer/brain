# Phase 07: Recording ID and Folder Assignment Correctness - Research

**Researched:** 2026-06-09
**Domain:** UUID/BIGINT dual-ID boundary, folder assignment write/read paths, TypeScript type widening
**Confidence:** HIGH — all findings verified by direct file reads; no assumed claims

---

## Summary

Phase 7 closes a class of silent data-loss bugs introduced by the UUID/BIGINT ID boundary: every folder assignment write path in the codebase hard-codes `parseInt()` or `number`-typed arguments, which means any recording whose `legacy_recording_id` is `null` (Zoom, manual paste, MCP/manual import) produces `NaN` or a UUID passed as a numeric type, and the write never happens. No error is surfaced; the user sees a success toast even though nothing was written.

The read path has a parallel problem. `getRecordingIdsForFolderFilter` (used by the filter-bar folder filter) reads only `folder_assignments` — never `workspace_entries.folder_id` — which means UUID-assigned recordings are invisible to named-folder filters. `getWorkspaceFolderRecordingIds` (used by sidebar folder navigation and the All-Calls path) already reads both sources correctly, so that path is safe.

The fix requires three coordinated changes: (1) widen the `AssignFolderDialog` props and `loadExistingAssignments`/`handleSave` methods to accept mixed IDs and route through `toRecordingUuid()`/`toRecordingUuidBatch()`; (2) add a `assignRecordingToFolder(recordingUuid, folderId)` service function that writes only to `workspace_entries.folder_id` for canonical UUID recordings and does NOT touch `folder_assignments`; (3) fix `getRecordingIdsForFolderFilter` to merge both sources (matching `getWorkspaceFolderRecordingIds`). The DnD path in `TranscriptsNew.handleDragEnd` and the `folderingCallId` state type both need the same widening.

**Primary recommendation:** Introduce a single `assignWorkspaceEntryToFolder(recordingUuid: string, folderId: string, workspaceId: string)` service function as the canonical write path for non-Fathom recordings. Update all call sites that currently reach `assignCallToFolder` with a parsed `number` to resolve the UUID first and choose the right write path.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Folder assignment write (Fathom) | API / Backend (service layer) | — | Fathom rows need `folder_assignments` (FK on BIGINT) + `workspace_entries.folder_id` dual-write |
| Folder assignment write (UUID-only) | API / Backend (service layer) | — | UUID rows only need `workspace_entries.folder_id`; must NOT touch `folder_assignments` |
| ID resolution (legacy→UUID) | `src/lib/recording-ids.ts` | Service layer | Canonical boundary — no `parseInt` anywhere else |
| Folder filter read (sidebar nav) | `transcript-filters.service.ts` `getWorkspaceFolderRecordingIds` | — | Already reads both sources; correct |
| Folder filter read (filter-bar named) | `transcript-filters.service.ts` `getRecordingIdsForFolderFilter` | — | **BUG:** reads `folder_assignments` only; must be fixed to read both |
| "Unorganized" filter | `transcript-filters.service.ts` `getAssignedFolderLegacyRecordingIds` | — | Returns `Set<number>` from `folder_assignments` only; misses UUID-assigned recordings |
| Drag-to-folder (DnD) | `TranscriptsNew.tsx` `handleDragEnd` | `DndCallProvider` | `parseInt` call in drag-end handler drops UUID IDs |
| Folder dialog UI | `AssignFolderDialog.tsx` | — | `parseInt` on load and save; only queries `folder_assignments` |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| P7-SC1 | `AssignFolderDialog` no longer uses `parseInt()`/`Number()` on mixed recording IDs; routes through `toRecordingUuid()`/`toRecordingUuidBatch()` or a service API that owns the split | See: `AssignFolderDialog.tsx` lines 70 and 244; `toRecordingUuidBatch` in `recording-ids.ts` |
| P7-SC2 | Folder assignment succeeds for Fathom, Zoom, manual paste, MCP import; no false success toast | See: `handleSave` bug at line 244; `moveWorkspaceEntryToFolder` private function in `folders.service.ts` |
| P7-SC3 | Writes keep `workspace_entries.folder_id` and `folder_assignments` consistent; non-Fathom rows not forced into BIGINT-only table | See: `folder_assignments` FK constraint in `supabase.ts`; `workspace_entries` schema |
| P7-SC4 | Named folder filtering reads both `workspace_entries.folder_id` and `folder_assignments` | See: `getRecordingIdsForFolderFilter` (broken) vs `getWorkspaceFolderRecordingIds` (correct) |
| P7-SC5 | Regression coverage: UUID recordings assign, unassign, and appear in named folder filters | See: `folders.integration.test.ts` — zero UUID coverage today |
| P7-SC6 | `npm run type-check`, folder/transcript tests, browser walkthrough | See: Validation section |
</phase_requirements>

---

## Standard Stack

### Core (no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `src/lib/recording-ids.ts` | in-repo | ID resolution boundary | Already canonical — `toRecordingUuid`, `toRecordingUuidBatch` |
| `src/services/folders.service.ts` | in-repo | Folder CRUD and assignment | Existing service layer |
| `src/services/transcript-filters.service.ts` | in-repo | Folder filter reads | Existing; `getWorkspaceFolderRecordingIds` is the correct merge pattern |
| Supabase JS client | existing | DB access | Project standard |
| Vitest | `^4.0.16` | Tests | Project standard — `npm run test` |

**No new packages required.** This phase is pure refactor + test coverage.

---

## Package Legitimacy Audit

No external packages are installed in this phase. Section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
User action (click/drag)
        |
        v
TranscriptTableRow.onFolderCall(call.recording_id)
  — call.recording_id = legacy_recording_id ?? uuid
        |
        v
TranscriptsTab.setFolderingCallId(callId as number)  ← BUG: type lie for UUID IDs
        |
        v
AssignFolderDialog
  loadExistingAssignments()
    — parseInt(id) for each targetRecordingId        ← BUG: NaN for UUID IDs
    — queries folder_assignments (BIGINT only)        ← BUG: misses workspace_entries
  handleSave()
    — parseInt(id).filter(!isNaN)                    ← BUG: silently drops UUID IDs
    — upserts to folder_assignments only             ← BUG: non-Fathom rows not written

CORRECT WRITE PATH (to implement):
  loadExistingAssignments():
    — toRecordingUuidBatch(targetRecordingIds)
    — query folder_assignments WHERE call_recording_id IN (legacyIds)
    — query workspace_entries WHERE recording_id IN (uuids)
    — merge results

  handleSave():
    — toRecordingUuidBatch(targetRecordingIds)
    — For each recording:
        IF has legacyId → upsert folder_assignments (Fathom dual-write)
        ALWAYS → upsert workspace_entries.folder_id (canonical write)

FILTER READ PATH:
  getRecordingIdsForFolderFilter (broken):
    — only queries folder_assignments
  
  getWorkspaceFolderRecordingIds (correct pattern):
    — queries workspace_entries.folder_id
    — queries folder_assignments + resolves to UUIDs via legacy_recording_id
    — merges + deduplicates
  
  FIX: make getRecordingIdsForFolderFilter match getWorkspaceFolderRecordingIds pattern
```

### Recommended Project Structure

No structural changes. Edits are confined to existing files:

```
src/
├── components/
│   └── AssignFolderDialog.tsx          # Fix: parseInt → toRecordingUuidBatch; dual-source load/save
├── components/transcripts/
│   └── TranscriptsTab.tsx              # Fix: folderingCallId type; onFolderCall widening
├── pages/
│   └── TranscriptsNew.tsx              # Fix: handleDragEnd parseInt → isLegacyId branch
├── hooks/
│   └── useFolderAssignment.ts          # Fix: callRecordingId: number → string | number
├── services/
│   ├── folders.service.ts              # Add: assignWorkspaceEntryToFolder(uuid, folderId, wsId)
│   └── transcript-filters.service.ts  # Fix: getRecordingIdsForFolderFilter to read both sources
└── services/__tests__/
    └── folders.integration.test.ts    # Add: UUID round-trip test cases
```

### Pattern 1: Dual-Source Folder Assignment Load (existing correct pattern in `getWorkspaceFolderRecordingIds`)

**What:** Query both `workspace_entries.folder_id` (for UUID-keyed recordings) and `folder_assignments` (for legacy BIGINT-keyed recordings), then merge + deduplicate results.
**When to use:** Any read that needs to know which recordings belong to a folder.

```typescript
// Source: src/services/transcript-filters.service.ts — getWorkspaceFolderRecordingIds
// This is the CORRECT pattern. getRecordingIdsForFolderFilter must be fixed to match it.

const { data: wsEntries } = await supabase
  .from('workspace_entries')
  .select('recording_id')
  .in('folder_id', folderIds)

const { data: folderAssigns } = await supabase
  .from('folder_assignments')
  .select('call_recording_id')
  .in('folder_id', folderIds)

const legacyIds = (folderAssigns || []).map(a => a.call_recording_id)
const legacyRecordingIds = await resolveLegacyRecordingIdsToUuids(legacyIds)

return Array.from(new Set([
  ...(wsEntries || []).map(e => e.recording_id),
  ...legacyRecordingIds
]))
```

### Pattern 2: Split Write — Fathom gets both; UUID-only gets workspace_entries only

**What:** The FK constraint on `folder_assignments` is `(call_recording_id, user_id) → fathom_raw_calls(recording_id, user_id)`. UUID-only recordings have no row in `fathom_raw_calls`, so writing to `folder_assignments` would violate the FK.
**When to use:** Every folder assignment write in the app.

```typescript
// Source: direct read of folder_assignments FK in src/types/supabase.ts
// foreignKeyName: "folder_assignments_call_recording_id_user_id_fkey"
// → referencedRelation: "fathom_raw_calls"

// NEW service function pattern:
export async function assignWorkspaceEntryToFolder(
  recordingUuid: string,
  folderId: string,
  workspaceId: string
): Promise<void> {
  // UUID-only path: only writes workspace_entries.folder_id
  // Does NOT touch folder_assignments (FK violation risk for non-Fathom rows)
  const { error } = await supabase
    .from('workspace_entries')
    .upsert(
      { workspace_id: workspaceId, recording_id: recordingUuid, folder_id: folderId },
      { onConflict: 'workspace_id,recording_id' }
    )
  if (error) throw new Error(`Failed to assign folder: ${error.message}`)
}
```

### Pattern 3: toRecordingUuidBatch for mixed-ID resolution

**What:** Split incoming mixed `(string | number)[]` IDs into UUID and numeric batches, run parallel DB lookups, return resolved UUIDs + original partitioned sets.
**When to use:** `AssignFolderDialog` — receives `string[]` that may be legacy BIGINT strings or UUIDs.

```typescript
// Source: src/lib/recording-ids.ts — toRecordingUuidBatch
const { resolved, uuids, legacyIds } = await toRecordingUuidBatch(targetRecordingIds)
// resolved: ResolvedRecording[] with { uuid, legacyId, sourceApp }
// uuids: string[] — all canonical UUIDs
// legacyIds: number[] — numeric IDs that had a legacy_recording_id
```

### Anti-Patterns to Avoid

- **`parseInt(recordingId)`:** Produces `NaN` for UUID strings; silently corrupts assignment writes. Use `isLegacyId()` + `isRecordingUuid()` from `recording-ids.ts` to branch.
- **Writing non-Fathom rows to `folder_assignments`:** FK violation. `folder_assignments.call_recording_id` → `fathom_raw_calls(recording_id)`. UUID-only recordings have no row in `fathom_raw_calls`.
- **Reading only `folder_assignments` for folder membership:** Misses any recording assigned via `workspace_entries.folder_id` (all non-Fathom recordings use this path after fix).
- **`callRecordingId: number` in hook/service signatures:** Blocks UUID strings. Widen to `string | number` at call sites; branch internally based on `isLegacyId()`.
- **`as number` cast on `call.recording_id` when the value may be a UUID string:** TypeScript won't catch this at runtime; the UUID string is passed as a numeric state variable and then `String()`-ified back, but the `parseInt` inside the dialog then silently drops it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID/legacy ID resolution | Custom `parseInt` + conditional | `toRecordingUuid()` / `toRecordingUuidBatch()` from `src/lib/recording-ids.ts` | Handles both Supabase calls, org-scoping, logging, null returns |
| Folder filter merge | Inline dual-source query | `getWorkspaceFolderRecordingIds()` pattern | Already deduplicates, handles child folder expansion |
| Legacy ID → UUID batch | Multiple `.maybeSingle()` calls | `toRecordingUuidBatch()` + parallel `.in()` queries | Two parallel queries vs N sequential |

**Key insight:** `getWorkspaceFolderRecordingIds` is the reference implementation for folder ID merging. `getRecordingIdsForFolderFilter` just needs to call the same two sources instead of one.

---

## Common Pitfalls

### Pitfall 1: False Success Toast on UUID Recordings
**What goes wrong:** `handleSave` in `AssignFolderDialog` runs `targetRecordingIds.map(id => parseInt(id)).filter(id => !isNaN(id))`. For UUID strings, `parseInt` returns `NaN`, filtered out — no DB write happens. The code continues to `toast.success(...)` unconditionally.
**Why it happens:** The filter removes `NaN` values but the success path doesn't check whether any writes actually occurred.
**How to avoid:** After the fix, build a `writtenCount` counter from actual DB operations. Show success toast only when `writtenCount > 0`; show a no-op message otherwise.
**Warning signs:** User assigns a Zoom/MCP recording to a folder, toast says "Meeting assigned to: FolderName" but the folder badge never appears.

### Pitfall 2: FK Violation When Writing UUID Recordings to `folder_assignments`
**What goes wrong:** `folder_assignments.call_recording_id` has a composite FK to `fathom_raw_calls(recording_id, user_id)`. Zoom/manual/MCP recordings have no row in `fathom_raw_calls`. Writing their (non-existent) legacy ID there fails with a FK violation; writing `NaN` converts to 0 which also fails.
**Why it happens:** `folder_assignments` was designed exclusively for Fathom. The fix must skip it entirely for UUID-only recordings.
**How to avoid:** After resolving IDs with `toRecordingUuidBatch`, only upsert `folder_assignments` for recordings where `legacyId !== null`. Always write `workspace_entries.folder_id` regardless.
**Warning signs:** Postgres error `insert or update on table "folder_assignments" violates foreign key constraint`.

### Pitfall 3: `getRecordingIdsForFolderFilter` vs `getWorkspaceFolderRecordingIds` Divergence
**What goes wrong:** Both functions claim to return recording IDs for a folder. `getWorkspaceFolderRecordingIds` reads both sources (correct). `getRecordingIdsForFolderFilter` reads only `folder_assignments` (broken). Fixing one without fixing the other leaves two code paths with different answers.
**Why it happens:** `getRecordingIdsForFolderFilter` was written before the `workspace_entries.folder_id` column existed.
**How to avoid:** Fix `getRecordingIdsForFolderFilter` to call `resolveLegacyRecordingIdsToUuids` after reading legacy assignments AND also read `workspace_entries.folder_id`, exactly as `getWorkspaceFolderRecordingIds` does. Both functions serve different call sites (filter bar vs sidebar/detail views) but must return the same logical set.

### Pitfall 4: `getAssignedFolderLegacyRecordingIds` Misses UUID-Assigned Recordings in "Unorganized" Filter
**What goes wrong:** The "unorganized" filter calls `getAssignedFolderLegacyRecordingIds()` which returns a `Set<number>` of `call_recording_id` values from `folder_assignments`. Non-Fathom recordings assigned via `workspace_entries.folder_id` return `null` for `legacy_recording_id`, so `assignedLegacyIds.has(null)` is false → they appear as "unorganized" even if they're in a folder.
**Why it happens:** The function was designed before `workspace_entries.folder_id` was used.
**How to avoid:** The "unorganized" check at `TranscriptsTab.tsx:675` should also check `workspace_entries.folder_id IS NULL` for the recording's UUID. The simplest fix is a new function `getAssignedRecordingUuids()` that reads both sources and returns `Set<string>` of UUIDs.

### Pitfall 5: DnD `handleDragEnd` in `TranscriptsNew.tsx` Drops UUID Drag IDs
**What goes wrong:** Lines 247-253 and 264-270 do `parseInt(raw, 10)` on the drag ID string. For UUID recordings, `raw` after stripping `"recording-"` prefix is a UUID string → `parseInt` returns `NaN` → filtered out → no folder assignment.
**Why it happens:** `DraggableCallRow` sets `id: "recording-${call.recording_id}"` where `call.recording_id` may be a UUID string.
**How to avoid:** After stripping `"recording-"`, use `isLegacyId(raw)` to detect numeric strings. Build a parallel UUID branch: if `isRecordingUuid(raw)`, call `assignWorkspaceEntryToFolder(raw, folderId, workspaceId)` directly.

---

## Code Examples

### Current Broken Pattern (AssignFolderDialog)

```typescript
// Source: src/components/AssignFolderDialog.tsx lines 70, 244 — BROKEN
const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));
// UUID strings → NaN; silently excluded from all DB operations

const numericRecordingIds = targetRecordingIds.map(id => parseInt(id)).filter(id => !isNaN(id));
// After filter: UUID-only recordings produce an empty array → zero writes
// Toast fires anyway
```

### Fixed Pattern (AssignFolderDialog load)

```typescript
// Source pattern from: src/lib/recording-ids.ts — toRecordingUuidBatch
const { resolved, uuids, legacyIds } = await toRecordingUuidBatch(targetRecordingIds)

// Load from both sources
const legacyAssigns = legacyIds.length > 0
  ? await supabase.from('folder_assignments')
      .select('call_recording_id, folder_id')
      .in('call_recording_id', legacyIds)
  : { data: [] }

const uuidAssigns = uuids.length > 0
  ? await supabase.from('workspace_entries')
      .select('recording_id, folder_id')
      .in('recording_id', uuids)
      .not('folder_id', 'is', null)
  : { data: [] }

// Merge folder IDs from both sources
const folderIdsFromLegacy = (legacyAssigns.data || []).map(a => a.folder_id)
const folderIdsFromUuids = (uuidAssigns.data || [])
  .map(a => a.folder_id)
  .filter((id): id is string => id !== null)
const combined = [...new Set([...folderIdsFromLegacy, ...folderIdsFromUuids])]
setSelectedFolders(new Set(combined))
```

### Fixed Pattern (`getRecordingIdsForFolderFilter`)

```typescript
// Source pattern from: src/services/transcript-filters.service.ts — getWorkspaceFolderRecordingIds
// getRecordingIdsForFolderFilter must be updated to match this:

export async function getRecordingIdsForFolderFilter(folderIds: string[]): Promise<string[]> {
  const allFolderIds = await getFolderAndChildIds(folderIds)
  if (allFolderIds.length === 0) return []

  // Source 1: workspace_entries.folder_id (canonical, UUID-keyed)
  const { data: wsEntries, error: wsError } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .in('folder_id', allFolderIds)
  if (wsError) throw wsError

  // Source 2: folder_assignments (legacy, BIGINT-keyed)
  const { data: legacyAssigns, error: legacyError } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .in('folder_id', allFolderIds)
  if (legacyError) throw legacyError

  const legacyIds = (legacyAssigns || []).map(a => a.call_recording_id)
  const legacyUuids = await resolveLegacyRecordingIdsToUuids(legacyIds)

  return Array.from(new Set([
    ...(wsEntries || []).map(e => e.recording_id),
    ...legacyUuids
  ]))
}
```

### New Service Function (UUID-only folder write)

```typescript
// To add to: src/services/folders.service.ts
/**
 * Assigns a canonical UUID recording to a folder via workspace_entries.folder_id.
 * Use this for non-Fathom recordings (no legacy_recording_id).
 * Does NOT touch folder_assignments — that table has a FK to fathom_raw_calls.
 */
export async function assignWorkspaceEntryToFolder(
  recordingUuid: string,
  folderId: string,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from('workspace_entries')
    .upsert(
      { workspace_id: workspaceId, recording_id: recordingUuid, folder_id: folderId },
      { onConflict: 'workspace_id,recording_id' }
    )
  if (error) throw new Error(`Failed to assign folder: ${error.message}`)
}

/**
 * Removes a canonical UUID recording from a folder (nulls workspace_entries.folder_id).
 */
export async function removeWorkspaceEntryFromFolder(
  recordingUuid: string,
  folderId: string,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from('workspace_entries')
    .update({ folder_id: null })
    .eq('recording_id', recordingUuid)
    .eq('workspace_id', workspaceId)
    .eq('folder_id', folderId)
  if (error) throw new Error(`Failed to remove folder: ${error.message}`)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `parseInt(recordingId)` for folder dialogs | Must use `toRecordingUuidBatch` | Phase 30 (2026) — UUIDs introduced | Silent data loss for non-Fathom recordings |
| `folder_assignments` as sole write target | Dual-write: `folder_assignments` + `workspace_entries.folder_id` | Migration `20260329000004` | `workspace_entries.folder_id` is the canonical modern key |
| `getRecordingIdsForFolderFilter` single-source | Must read both sources | Now (Phase 7) | Named folder filter invisible to UUID recordings |

**Deprecated/outdated:**
- Writing to `folder_assignments` for non-Fathom recordings: violates FK, must never be done
- `callRecordingId: number` in `useFolderAssignment.ts` hooks: must be widened to `string | number` to accept UUIDs

---

## Detailed Bug Map (Exact File Locations)

### Bug 1: `AssignFolderDialog.loadExistingAssignments` — line 70
```typescript
// CURRENT (broken):
const numericRecordingIds = targetRecordingIds.map(id => parseInt(id));
// UUID input like "abc123..." → parseInt → NaN

// Also: queries only folder_assignments, ignores workspace_entries.folder_id
```
**Fix:** Replace with `toRecordingUuidBatch(targetRecordingIds)` + dual-source query.

### Bug 2: `AssignFolderDialog.handleSave` — line 244
```typescript
// CURRENT (broken):
const numericRecordingIds = targetRecordingIds.map(id => parseInt(id)).filter(id => !isNaN(id));
// UUID IDs filtered out → empty array → zero writes → false success toast
```
**Fix:** Use `toRecordingUuidBatch` to split IDs; write `folder_assignments` for legacyId records, write `workspace_entries.folder_id` for all records.

### Bug 3: `TranscriptsTab.tsx` line 155 + 1258
```typescript
// State type:
const [folderingCallId, setFolderingCallId] = useState<number | null>(null);
// Cast in callback:
onFolderCall={(callId) => setFolderingCallId(callId as number)}
```
`call.recording_id` in `mapRecordingToMeeting` is `recording.legacy_recording_id ?? recording.id` — so for non-Fathom recordings it is a UUID string. The `as number` cast is a type lie; the string gets stored and then `String(folderingCallId)` passed to `AssignFolderDialog.recordingId` is correct, but the state type misleads. The root fix is widening the state to `number | string | null`.

### Bug 4: `TranscriptsNew.tsx` `handleDragEnd` — lines 247-253, 264-270
```typescript
const id = parseInt(raw, 10);
if (!isNaN(id)) acc.push(id);
```
UUID drag IDs (from non-Fathom rows) are silently dropped. DnD folder assignment is Fathom-only today.
**Fix:** Branch on `isLegacyId(raw)` vs `isRecordingUuid(raw)` and call the appropriate service function.

### Bug 5: `getRecordingIdsForFolderFilter` — lines 92-105
Reads only `folder_assignments`. `getWorkspaceFolderRecordingIds` (lines 59-90) is the correct dual-source pattern.
**Fix:** Rewrite to match `getWorkspaceFolderRecordingIds` read pattern.

### Bug 6: `getAssignedFolderLegacyRecordingIds` — lines 107-115
Returns `Set<number>` from `folder_assignments` only. The "unorganized" filter at `TranscriptsTab.tsx:675` uses `assignedLegacyIds.has(r.legacy_recording_id)` — for UUID-only recordings `legacy_recording_id` is null, so `has(null)` = false → they always appear "unorganized" regardless of `workspace_entries.folder_id`.
**Fix:** Add a companion function `getAssignedRecordingUuids()` that reads both sources and returns `Set<string>` of canonical UUIDs. Use it alongside (or replace) the legacy check.

### Bug 7: `useFolderAssignment.ts` hook signatures — all three hooks
All three mutation hooks (`useAssignToFolder`, `useRemoveFromFolder`, `useMoveToFolder`) have `callRecordingId: number`. The underlying service functions also take `number`.
**Fix:** Widen to `string | number`; inside the mutation function, branch: if `isLegacyId(callRecordingId)` → existing numeric path; if `isRecordingUuid(callRecordingId)` → new UUID-direct path.

---

## Assumptions Log

No assumed claims. All findings are [VERIFIED] by direct file reads.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | No assumed claims | — | — |

**All claims in this research were verified by direct codebase inspection — no user confirmation needed.**

---

## Open Questions

1. **Should `AssignFolderDialog` be refactored to use the service layer (`assignCallToFolder`, `assignWorkspaceEntryToFolder`) instead of inline Supabase calls?**
   - What we know: The dialog currently does inline Supabase calls; the service functions duplicate some of the same logic.
   - What's unclear: Whether the dialog's multi-folder-assignment pattern (one recording, many folders simultaneously via checkboxes) maps cleanly to the single-folder service functions.
   - Recommendation: Add the dual-source load/save directly in the dialog for minimum diff; extract to a new `assignRecordingToFolders(recordingIds, folderIds)` service function if that keeps the change contained.

2. **`getAssignedFolderLegacyRecordingIds` — replace or augment for the "unorganized" filter?**
   - What we know: The function is called by exactly two sites in `TranscriptsTab.tsx` (lines 580 and 664), both for the "unorganized" filter path.
   - What's unclear: Whether a replacement returning `Set<string>` of UUIDs covers the use case completely (it checks `assignedLegacyIds.has(r.legacy_recording_id)` — a UUID-UUID check would work if we pass `r.id` instead).
   - Recommendation: Add `getAssignedWorkspaceEntryFolderUuids()` returning `Set<string>`, then update the two call sites to `!assignedUuids.has(r.id)` and remove the `legacy_recording_id` null check.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure TypeScript/service layer refactor with existing test infrastructure).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.16` |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- src/services/__tests__/folders.integration.test.ts src/services/__tests__/folders.service.test.ts src/components/transcripts/__tests__/folder-filtering.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P7-SC1 | `AssignFolderDialog` no longer uses `parseInt` | unit | `npm test -- src/services/__tests__/folders.service.test.ts` | ✅ (extend existing) |
| P7-SC2 | UUID recording folder assign succeeds | integration | `npm run test:integration -- src/services/__tests__/folders.integration.test.ts` | ✅ (extend with UUID case) |
| P7-SC3 | Dual-write consistency | unit + integration | Both above | ✅ |
| P7-SC4 | `getRecordingIdsForFolderFilter` reads both sources | unit | `npm test -- src/components/transcripts/__tests__/folder-filtering.test.ts` | ✅ (extend existing) |
| P7-SC5 | UUID assign/unassign/filter regression | integration | `npm run test:integration -- src/services/__tests__/folders.integration.test.ts` | ❌ Wave 0 gap |
| P7-SC6 | Type-check pass | type | `npm run type-check` | ✅ |

### Sampling Rate
- **Per task commit:** `npm run type-check && npm test -- src/services/__tests__/folders.service.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] UUID round-trip test cases in `src/services/__tests__/folders.integration.test.ts` — covers P7-SC5 (UUID assign → visible in filter → unassign → no longer visible)
- [ ] `getRecordingIdsForFolderFilter` unit test extension — add a mock case where `workspace_entries` has folder_id set but `folder_assignments` is empty; verify UUIDs returned

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | All Supabase queries inherit RLS; no bypass needed |
| V5 Input Validation | yes | `isRecordingUuid()` / `isLegacyId()` from `recording-ids.ts` validate ID format before DB ops |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Passing raw user-provided recording ID to DB | Tampering | Route through `toRecordingUuid()`/`toRecordingUuidBatch()` — validates format, org-scopes the lookup |
| False success UI feedback | Spoofing (trust) | Check `writtenCount > 0` before success toast |

No new attack surface is introduced by this phase. RLS on `folder_assignments` and `workspace_entries` is the data-access gate.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/components/AssignFolderDialog.tsx` — full file read; exact line numbers of `parseInt` bugs documented
- `src/hooks/useFolderAssignment.ts` — full file read; `number`-typed mutation signatures confirmed
- `src/services/folders.service.ts` — full file read; `assignCallToFolder`, `moveWorkspaceEntryToFolder`, `removeCallFromFolder`, `deleteFolder` all verified
- `src/services/transcript-filters.service.ts` — full file read; `getRecordingIdsForFolderFilter` (broken) vs `getWorkspaceFolderRecordingIds` (correct) confirmed
- `src/lib/recording-ids.ts` — full file read; `toRecordingUuid`, `toRecordingUuidBatch`, `isLegacyId`, `isRecordingUuid` signatures confirmed
- `src/components/dnd/DndCallProvider.tsx` — full file read; `parseInt` in `handleDragEnd` confirmed (but note: `DndCallProvider` is a separate component from the main drag handler in `TranscriptsNew.tsx`)
- `src/pages/TranscriptsNew.tsx` offset 120-278 — `handleDragEnd` `parseInt` at lines 247-253, 264-270 confirmed; `assignToFolder(numericIds, folderId)` call confirmed
- `src/components/transcripts/TranscriptsTab.tsx` — key sections read; `folderingCallId: number | null` type and `as number` cast confirmed; `getAssignedFolderLegacyRecordingIds` call sites confirmed
- `src/components/transcript-library/TranscriptTableRow.tsx` — `onFolderCall(call.recording_id)` confirmed; `call.recording_id = legacy_recording_id ?? uuid` mapping confirmed via `mapRecordingToMeeting`
- `src/hooks/useWorkspaces.ts` offset 405-432 — `mapRecordingToMeeting` implementation confirmed; `recording_id: recording.legacy_recording_id ?? recording.id` confirmed
- `src/services/__tests__/folders.integration.test.ts` — full file read; `TEST_LEGACY_ID = 999000001` (numeric only); zero UUID round-trip coverage confirmed
- `src/services/__tests__/folders.service.test.ts` — full file read; only numeric `callRecordingId` tested
- `src/components/transcripts/__tests__/folder-filtering.test.ts` — full file read; tests dual-source pattern but via mock — covers the pattern, not the broken `getRecordingIdsForFolderFilter`
- `src/types/supabase.ts` — `folder_assignments` FK to `fathom_raw_calls` confirmed; `workspace_entries.folder_id` UUID FK to `folders` confirmed

### Secondary
- `.planning/ROADMAP.md` — Phase 7 success criteria, depends-on chain
- `.planning/STATE.md` — "Recording ID dual system" in Phase-Spanning Knowledge

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — every claim verified by direct file read with line numbers
- Fix pattern: HIGH — `getWorkspaceFolderRecordingIds` and `toRecordingUuidBatch` are verified correct implementations in-repo
- Test gap identification: HIGH — `folders.integration.test.ts` read in full; `TEST_LEGACY_ID = 999000001` numeric-only is the entire test fixture

**Research date:** 2026-06-09
**Valid until:** Until any of the five identified files change significantly (estimated 60 days for stable service layer)
