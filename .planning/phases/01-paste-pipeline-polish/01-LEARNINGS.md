---
phase: 1
phase_name: "Paste Pipeline Polish"
project: "CallVault"
generated: "2026-05-27T18:04:00Z"
counts:
  decisions: 2
  lessons: 2
  patterns: 1
  surprises: 1
missing_artifacts:
  - "01-UAT.md"
---
# Phase 1 Learnings: Paste Pipeline Polish

## Decisions

### Included Loom Parser as Phase 1 Scope
Loom parser updates were included alongside SRT/Otter parsers as valid Phase 1 scope because the user had separately reported the Loom pasting bug.
**Rationale:** Fixing user-reported bugs related to the pipeline is critical to the Phase 1 goal of polishing the paste experience.
**Source:** `gemini-handoff-20260527T175603Z.md`

### Actionable Inline Errors over Generic Toasts
Migrated from generic `toast.error()` popups to friendly inline error banners in `PasteTranscriptModal.tsx`.
**Rationale:** Provides actionable UI links (like "View it" for deduplicated recordings) directly where the user is working.
**Source:** `01-C-SUMMARY.md`

---

## Lessons

### `tsc --noEmit` is Insufficient for Edge Functions
Frontend typescript compilation checks do not properly validate Deno Edge Functions.
**Context:** A bad import for `srtTimestampToSeconds` slipped past the frontend checks but was caught by Deno.
**Source:** `gemini-handoff-20260527T175603Z.md`

### Skipped Tests are NOT Passing Tests
A test suite that skips execution because of missing credentials cannot be counted as "passing against real Supabase".
**Context:** Integration tests skipped locally due to missing `SUPABASE_TEST_*` credentials, which was previously misreported as a successful database verification.
**Source:** `gemini-handoff-20260527T175603Z.md`

---

## Patterns

### Explicit Deno Checking
**Description:** Always run `deno check supabase/functions/<function>/index.ts` for any Edge Function touched during a phase.
**When to use:** During the local verification step to ensure Deno-specific imports and typing are structurally valid.
**Source:** `gemini-handoff-20260527T175603Z.md`

---

## Surprises

### Integration Verification Gap
**What was surprising:** That the integration tests were passing, but bypassing the actual backend database constraint checks due to missing credentials.
**Impact:** Required a rollback in the GSD state to clarify that local verification is passed, but live real-DB verification is still pending.
**Source:** `gemini-handoff-20260527T175603Z.md`
