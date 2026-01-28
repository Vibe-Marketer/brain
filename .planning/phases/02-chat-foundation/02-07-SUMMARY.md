---
phase: 02-chat-foundation
plan: 07
subsystem: ui
tags: [react, markdown, citations, hover-card, chat, inline-markers]

# Dependency graph
requires:
  - phase: 02-05
    provides: 14 RAG tool definitions with recording_id in results
  - phase: 02-06
    provides: /chat2 test path for v2 backend
provides:
  - Inline [N] citation markers in assistant message text
  - CitationMarker component with hover tooltip
  - SourceList bottom-of-message citation list
  - parseCitations() text parser for [N] markers
  - extractSourcesFromParts() tool result source extraction
  - System prompt citation instructions for numbered markers
affects: [02-08, 02-09, phase-7-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MarkdownWithCitations: custom react-markdown component overrides for inline citation injection"
    - "Citation parsing pipeline: extractSourcesFromParts → citationSourcesToSourceData → parseCitations → CitationMarker"
    - "stripSourcesList: remove model's text source list in favor of SourceList component"

key-files:
  created: []
  modified:
    - src/components/chat/message.tsx
    - src/components/chat/source.tsx
    - src/pages/Chat.tsx
    - supabase/functions/chat-stream-v2/index.ts

key-decisions:
  - "Custom Markdown component overrides (p, li, td, strong, em) to inject CitationMarker into text flow without breaking markdown formatting"
  - "Strip model's text source list and replace with structured SourceList component"
  - "System prompt instructs model to use numbered [1], [2] markers with bottom sources list format"
  - "CitationMarker uses HoverCard (not Tooltip) for rich preview with title, speaker, date, snippet"

patterns-established:
  - "Citation pipeline: tool results → CitationSource[] → SourceData[] → inline markers + bottom list"
  - "MarkdownWithCitations: processChildren recursion scans string children for [N] patterns"

# Metrics
duration: 6min
completed: 2026-01-28
---

# Phase 2 Plan 7: Inline Citations Summary

**Inline [N] citation markers with hover preview, click-to-open CallDetailDialog, and bottom SourceList for chat responses**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-28T06:21:07Z
- **Completed:** 2026-01-28T06:27:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Inline numbered citation markers [1], [2] appear in assistant response text via custom Markdown component overrides
- Hovering a citation marker shows HoverCard tooltip with call title, speaker, date, and text snippet
- Clicking a citation marker or SourceList entry opens CallDetailDialog via existing handleViewCall flow
- Bottom SourceList component replaces old pill-style Sources for messages with citations
- System prompt updated to instruct model to use numbered citation format with sources list
- Citations persist across page reload (tool results in JSONB parts survive JSON round-trip)

## Task Commits

Each task was committed atomically:

1. **Task 1: Citation parsing and inline markers in message.tsx** - `d0baeac` (feat)
2. **Task 2: CitationMarker, SourceList, and wire citation flow** - `027843c` (feat)

## Files Created/Modified
- `src/components/chat/message.tsx` - Added CitationSource interface, extractSourcesFromParts(), parseCitations(), stripSourcesList(), MarkdownWithCitations component, extended AssistantMessage with citations/onCitationClick props
- `src/components/chat/source.tsx` - Added CitationMarker component (superscript [N] with HoverCard), SourceList component (bottom citation list)
- `src/pages/Chat.tsx` - Replaced old source extraction with extractSourcesFromParts, wired citations to AssistantMessage, replaced Sources with SourceList
- `supabase/functions/chat-stream-v2/index.ts` - Updated system prompt citation instructions to use numbered [1], [2] markers with structured sources list

## Decisions Made
- **Custom Markdown overrides over text pre-processing**: Used react-markdown's `components` prop to override text-containing elements (p, li, td, strong, em) with versions that scan string children for [N] patterns. This preserves full markdown formatting while injecting React components inline.
- **Strip model's source list**: The model outputs a text-based sources section at the end. We strip this via regex and render our own interactive SourceList component instead.
- **HoverCard over Tooltip**: CitationMarker uses HoverCard (from existing shadcn component) for rich content preview, not Tooltip, since it needs multi-line content with title, metadata, and snippet.
- **Numbered markers in system prompt**: Updated system prompt to instruct the model to output `[1]`, `[2]` numbered citation markers and a structured bottom sources list, matching the parsing regex.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Citation system complete and wired end-to-end
- Ready for 02-08-PLAN.md (streaming error handling, retry UX, connection stability)
- All previous features preserved (incomplete message indicator, retry button, tool call display)

---
*Phase: 02-chat-foundation*
*Completed: 2026-01-28*
