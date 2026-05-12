---
phase: 35
phase_name: Table, Filters & DND Cleanup
gathered: 2026-05-11
status: Ready for planning
mode: Auto-generated from REQUIREMENTS.md (all items fully specified)
---

# Phase 35: Table, Filters & DND Cleanup — Context

<domain>
## Phase Boundary

Clean up the 3rd-pane recording table, remove redundant filters, fix remaining filter behaviors, and stabilize drag-and-drop handles. Depends on Phase 30 (UUID fix) for TABLE-02 Folders column population.

Out of scope: visual selection-state on table rows (Phase 33 scope or v2.3), global search modal styling (Phase 34 BRAND-08), sort algorithm bugs in non-date columns (Phase 36 BUG-04 covers date).
</domain>

<decisions>
## Implementation Decisions

### Table Cleanup (3rd Pane)

- **TABLE-01** — Remove "Shared" column. Audit any place it's referenced (header label, cell renderer, sort handler, column config) and delete. Update any column width / total-row-width math.
- **TABLE-02** — "Folders" column reflects current folder assignment for every call. **Depends on Phase 30 UUID fix** (already shipped via Plans 30-01/02/04). Verify the column populates for both Fathom (legacy_recording_id-keyed) and Zoom (UUID-keyed) sources after Phase 30 ships.
- **TABLE-03** — Column alignment standardized: **left-aligned for all text columns**, right-aligned for numeric/duration columns. Header alignment matches cell alignment. Pick consistent vertical padding.

### Filters (3rd Pane)

- **FILTER-01** — Remove Folder filter entirely. Folder selection IS the 2nd pane — having a duplicate filter is redundant.
- **FILTER-02** — Remove Duration filter. Low-value per requirements.
- **FILTER-03** — Contacts filter queries the **full contacts DB**, not just invitees/attendees. Searching "Phill" should return Phill Tomlinson. Current implementation likely scopes to call participants only. Switch to full `contacts` table query (or whichever table holds the canonical contacts).
- **FILTER-04** — Source filter UX:
  - Apply/Clear buttons fit within the popover (no overflow).
  - Second row of source pills visible without hover (currently requires hover).
  - Plan-phase audits the popover layout: probably needs `max-width` + flex-wrap on the pill row + `flex-shrink-0` on Apply/Clear.

### Drag-and-Drop (DND)

- **DND-01** — Drag target is position-stable. The handle/drag-target does NOT shift when the underlying item is selected (today: selection adds the orange pill which probably pushes the handle right). Implementation: position the drag handle outside the selection-state container, OR use `position: absolute` with a fixed offset that's selection-state-agnostic.
- **DND-02** — Drag target enlarged to occupy left ⅓–½ of the card, centered around the icon next to the title. Much easier to grab. Use `dnd-kit` or whatever the current DND library is — wrap the icon + label area as the draggable, not just the handle.

### Test Strategy

- **Visual regression** for table + filter UI via dev-browser screenshots.
- **Behavior tests** for FILTER-03 contacts query (real-DB integration test: create a contact "Phill Tomlinson", call FILTER-03 with query "Phill", assert he appears).
- **DND smoke test** via dev-browser: drag a call into a folder, verify it lands. With selection state on and off.
- **Verify Phase 30 dependency met** before TABLE-02 verification — Phase 30 must be `passed` first.

### Sequencing

1. TABLE-01 (remove Shared column) — fast, atomic.
2. TABLE-03 (alignment) — depends on column set being final.
3. FILTER-01 + FILTER-02 (remove filters) — fast, atomic.
4. FILTER-04 (Source filter UX).
5. FILTER-03 (Contacts query change) — most involved, real DB.
6. DND-01 + DND-02 — DND library work.
7. TABLE-02 verification — after Phase 30 ships.
</decisions>

<code_context>
## Existing Code Insights

**Likely target files:**
- `src/components/transcript-library/TranscriptTable.tsx` — column config (TABLE-01, TABLE-02, TABLE-03)
- `src/components/transcript-library/TranscriptTableRow.tsx` — cell rendering
- `src/components/transcript-library/FilterBar.tsx` (or similar) — filter pills (FILTER-01..04)
- `src/hooks/useFilters.ts` or filter store — filter state management
- `src/hooks/useContacts.ts` or contacts service — for FILTER-03 query target
- `src/components/transcript-library/DraggableCallCard.tsx` (or similar) — DND-01, DND-02

**Reusable foundations:**
- `dnd-kit` (likely the DND library)
- shadcn Popover for filter pills
- TanStack Query for contact searches

**Phase dependency:**
- Phase 30 (UUID/Legacy-ID) must be passed before TABLE-02 verification.
</code_context>

<specifics>
## Requirements (from REQUIREMENTS.md)

- **TABLE-01** Remove Shared column
- **TABLE-02** Folders column reflects assignment (Phase 30 dependency)
- **TABLE-03** Column alignment standardized
- **FILTER-01** Folder filter removed
- **FILTER-02** Duration filter removed
- **FILTER-03** Contacts filter queries full DB
- **FILTER-04** Source filter overflow + visible second row
- **DND-01** Drag target position-stable across selection
- **DND-02** Drag target enlarged (left ⅓–½)

## Success Criteria (from ROADMAP.md)

1. Shared column removed, Folders column populates for all calls (post-Phase-30), alignment standardized.
2. Folder and Duration filters removed from UI.
3. Contacts filter returns matches from full contacts DB.
4. Source filter popover doesn't overflow; second row visible.
5. DND handle stable + larger.

## Verification Strategy

- Dev-browser per-fix screenshots + functional checks.
- FILTER-03 real-DB integration test (Phill contact appears in search).
- DND smoke test: drag a call with + without selection state, verify handle position consistent.
- Phase 30 VERIFICATION must be `passed` before TABLE-02 marked complete.
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 35 section
- `.planning/REQUIREMENTS.md` — TABLE-01..03, FILTER-01..04, DND-01..02
- `.planning/phases/30-uuid-legacy-id-root-cause-fix/` — UUID fix prerequisite
- `.planning/codebase/STRUCTURE.md` — file layout
- `src/CLAUDE.md` — design tokens + DND library
- `src/components/transcript-library/TranscriptTable.tsx` — main table
</canonical_refs>

<deferred>
## Deferred Ideas

- **Custom column show/hide** — user-configurable table columns. v2.3 candidate.
- **Saved filter sets** — let user save "my favorite filter combo". v2.3.
- **Bulk DND** — drag multiple selected calls at once. v2.3.
</deferred>
