---
phase: 01-paste-pipeline-polish
plan: 01
subsystem: backend
tags: [manual-import, transcript-parsing, edge-functions, docs]
requires: []
provides:
  - Backend parser contract for supported Phase 1 manual transcript formats
  - No-data-loss raw fallback for malformed VTT/SRT-style imports
  - Canonical transcript format documentation for future parser work
affects: [phase-01-verification, manual-import-ui, transcript-detail]
tech-stack:
  added: []
  patterns:
    - Shared Deno/Vite parser helpers remain pure TypeScript
    - Malformed structured transcript input degrades to raw preservation
key-files:
  created: []
  modified:
    - docs/architecture/transcript-formats.md
    - supabase/functions/_shared/loom-parser.ts
    - supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts
    - supabase/functions/save-pasted-transcript/index.ts
key-decisions:
  - "Missing manual-import speakers use the literal Unknown Speaker."
  - "Malformed structured transcript imports preserve raw text instead of returning parser errors."
  - "Markdown .md remains transcript text input, not document ingestion."
patterns-established:
  - "Raw transcript fallback returns parseStatus raw, transcriptSegments null, and fullTranscript set to the original text."
requirements-completed: [MAN-02]
duration: 9min
completed: 2026-05-27
---

# Phase 01 Plan 01: Parser Contract Summary

**Manual transcript parser fallback now preserves raw text across weak structured inputs and documents the Phase 1 format contract.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-27T22:28:00Z
- **Completed:** 2026-05-27T22:37:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced remaining missing-speaker fallbacks with `Unknown Speaker` in backend normalization and Loom parsing.
- Added raw-preserving fallback behavior for malformed Zoom VTT and SRT imports instead of throwing parser errors.
- Preserved Otter raw imports in `fullTranscript` when no turns can be trusted.
- Updated `docs/architecture/transcript-formats.md` to list Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and Markdown `.md`, including D-01 through D-06.
- Added source-regression tests for `Unknown Speaker` and raw fallback wiring.

## Task Commits

1. **Task 1: Harden backend normalization for supported manual transcript formats** - `2fd68edb` (fix)
2. **Task 2: Publish canonical manual transcript contract in docs** - `2fd68edb` (fix)

## Files Created/Modified

- `supabase/functions/save-pasted-transcript/index.ts` - Adds shared `Unknown Speaker` fallback and raw-preserving normalization for weak structured imports.
- `supabase/functions/_shared/loom-parser.ts` - Stops inventing `Speaker 1` for Loom transcripts without speaker names.
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` - Locks in `Unknown Speaker` and raw fallback invariants.
- `docs/architecture/transcript-formats.md` - Documents the Phase 1 manual transcript contract.

## Decisions Made

- Kept fallback behavior inside the existing normalization flow rather than introducing a new parser contract.
- Treated Markdown `.md` as manual transcript text and explicitly excluded audio/video upload from the Phase 1 docs.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

The current codebase already had partial prior Phase 1 implementation, but verification showed concrete gaps in `Unknown Speaker` and raw fallback behavior. Those gaps were closed in the task commit.

## Verification

- `npm test -- --run supabase/functions/_shared/__tests__/srt-parser.test.ts supabase/functions/_shared/__tests__/vtt-parser.test.ts supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` - passed, 87 tests.
- `rg -n "Loom|Markdown|Unknown Speaker|raw fallback|full_transcript|D-0[1-6]" docs/architecture/transcript-formats.md` - passed.
- `git diff --check` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 01-02. The backend parser contract now matches the UI copy and verification plans that follow.

---
*Phase: 01-paste-pipeline-polish*
*Completed: 2026-05-27*
