# Phase 13: Drag-to-Folder + Global Search - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire existing drag-and-drop components (DndCallProvider, FolderDropZone, useFolderAssignment) and rebuild the global search modal (~200 lines) with Cmd+K shortcut. All underlying hooks and services exist — this phase is pure integration wiring.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/wiring phase. Key assets from codebase audit:
- DndCallProvider.tsx, FolderDropZone.tsx, useFolderAssignment.ts — ALL complete, need 4 wiring points
- GlobalSearchModal deleted in commit 2ae0e175 — need ~200-line rebuild; useGlobalSearch.ts hook is complete
- Search must be org-scoped (Phase 11 foundation ensures this)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/dnd/DndCallProvider.tsx` — DnD context provider
- `src/components/dnd/FolderDropZone.tsx` — Drop zone wrapper for folder items
- `src/hooks/useFolderAssignment.ts` — Handles call-to-folder assignment mutation
- `src/hooks/useGlobalSearch.ts` — Complete search hook with debounce, org-scoping

### Integration Points
- TranscriptTable needs DndCallProvider wrapper
- TranscriptTableRow needs DraggableCallRow wrapper
- FolderSidebar items need FolderDropZone wrapper
- GlobalSearchModal needs rebuild (~200 lines) + Cmd+K shortcut registration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 13-drag-to-folder-global-search*
*Context gathered: 2026-03-30 via infrastructure skip*
