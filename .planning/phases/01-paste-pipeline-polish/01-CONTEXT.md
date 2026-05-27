# Phase 1: Paste Pipeline Polish - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 makes manual transcript import launch-ready. The supported v1 path is transcript import, not audio/video transcription: users can paste or select transcript text files, CallVault parses what it can, saves without data loss, shows friendly failure states, and hides audio/video file-upload entry points until v2.

In scope: Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and Markdown `.md` transcript inputs; real-Supabase behavioral tests for `save-pasted-transcript`; friendly paste/import errors; removal of `FileUploadDropzone` and other audio/video upload CTAs from user-facing import/onboarding surfaces.

Out of scope: async transcription, audio/video file upload, bulk upload, Deepgram/Whisper pipeline changes, and broad navigation redesign.

</domain>

<decisions>
## Implementation Decisions

### Format Parsing Boundaries
- **D-01:** Use best-effort parsing with no data loss. When a structured transcript is malformed, parse whatever turns can be safely extracted; if parsing cannot produce usable structure, save the raw transcript with `parse_status: raw`.
- **D-02:** Speaker labels come only from detected transcript labels. If a turn has no reliable speaker label, use `Unknown Speaker`; do not aggressively infer speakers from attendees, titles, or headers.
- **D-03:** Preserve real timestamps when present. When timing is missing, use stable sequential offsets; fall back to `0` only when no sequential timing can be derived.
- **D-04:** Phase 1 supported manual formats are Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and Markdown `.md`.
- **D-05:** Loom should be treated as an expected existing path, not speculative new scope. Downstream agents must verify and preserve the existing `loom` support in `save-pasted-transcript`, `_shared/loom-parser.ts`, and transcript-format docs.
- **D-06:** Markdown `.md` is a text transcript input, not a new document-ingestion pipeline. Accept the extension, preserve Markdown in `full_transcript`, and best-effort parse speaker/timestamp turns only when they follow known patterns.

### File-Upload Removal Line
- **D-07:** Remove audio/video upload entry points only. Hide `FileUploadDropzone`, File Upload source cards, onboarding upload cues, and audio/video upload copy.
- **D-08:** Keep transcript file selection inside the manual transcript modal for `.vtt`, `.srt`, `.txt`, and `.md`. This is transcript import, not audio/video transcription.
- **D-09:** Hide `file-upload` from user-facing import/onboarding surfaces while preserving enough internal metadata/type handling to avoid breaking old rows or in-flight callers. Planning should verify whether any existing `file-upload` rows exist before trimming compatibility code.
- **D-10:** Remove audio/video upload CTAs entirely. Do not replace them with a new upload CTA.
- **D-11:** Rename the manual transcript entry point to **Import Transcript**. This label covers paste, transcript files, Markdown, Loom/Fathom links, and raw text without implying audio/video upload.
- **D-12:** Consider whether the main `Import` sidebar/nav label should be clearer and more industry-standard only if naturally touched by Phase 1 import-surface copy work. Do not expand Phase 1 into unrelated navigation redesign.

### Testing & Verification
- **D-13:** MAN-04 tests must be behavioral HTTP-level integration tests against a real Supabase test project. Do not mock Supabase.
- **D-14:** Integration coverage must include auth rejection, workspace/org membership rejection, dedup behavior, format detection across supported formats, and raw fallback/no-data-loss behavior.
- **D-15:** UI verification must prove the audio/video upload path is no longer reachable while Import Transcript still allows transcript-file inputs.

### Agent's Discretion
- Exact parser heuristics for weak Otter/Markdown/plain-text detection, as long as they follow best-effort/no-data-loss behavior.
- Exact inline error copy, as long as messages are friendly and give the user a clear next step.
- Whether compatibility checks for existing `file-upload` rows are done through SQL, source inspection, or both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, MAN-02/MAN-04/MAN-05/MAN-06 mapping, and file-upload v2 boundary.
- `.planning/REQUIREMENTS.md` — v1 manual transcript requirements and out-of-scope file upload/async transcription requirements.
- `.planning/PROJECT.md` — project-level constraints, One-Click Promise, direct-main workflow, and file-upload scope change.
- `.planning/STATE.md` — current milestone status and verification caveats.
- `.planning/research/SUMMARY.md` — parser/library guidance and binding real-Supabase test constraint.

### Codebase Maps & Rules
- `.planning/codebase/ARCHITECTURE.md` — service/hook separation, AppShell, Edge Function call patterns, and cache invalidation shape.
- `.planning/codebase/STACK.md` — React/Vite/TanStack/Supabase stack and npm-only constraint.
- `.planning/codebase/STRUCTURE.md` — import, connector, Edge Function, and docs file organization.
- `.planning/codebase/CONVENTIONS.md` — local implementation conventions.
- `.planning/codebase/TESTING.md` — Vitest/integration test layout and real-DB test patterns.
- `.planning/codebase/CONCERNS.md` — fragile surfaces, especially real-DB precedent, recording ID boundaries, and source URL handling.
- `CLAUDE.md` — root One-Click Promise, direct-main workflow, and hard constraints.
- `src/CLAUDE.md` — frontend constraints, Remix icons only, no Lucide, and UI/state patterns.
- `supabase/CLAUDE.md` — Edge Function structure and shared auth requirement.
- `docs/CLAUDE.md` — docs standards for architecture/spec updates.

### Phase 1 Implementation Surfaces
- `src/components/import/PasteTranscriptModal.tsx` — manual transcript modal, current source/mode labels, transcript file input, friendly error state, parser preview.
- `src/pages/ImportPage.tsx` — import page currently importing/rendering `FileUploadDropzone`; must be corrected for MAN-06.
- `src/components/import/FileUploadDropzone.tsx` — audio/video upload component to hide from user-facing import flow, not necessarily delete.
- `src/components/panes/ImportSourcePane.tsx` — import source list surface that may expose File Upload.
- `src/components/onboarding/OnboardingModal.tsx` — onboarding upload cues must stay removed/hidden.
- `src/components/connectors/registry/adapters/file-upload.ts` — internal file-upload adapter compatibility surface.
- `src/lib/import-source-flow.ts` — source-flow classification that may still route `file-upload`.
- `supabase/functions/save-pasted-transcript/index.ts` — save endpoint, source inference, normalization paths, auth, dedup, and pipeline insertion.
- `supabase/functions/_shared/loom-parser.ts` — existing Loom parser support that must be verified/preserved.
- `supabase/functions/_shared/srt-parser.ts` — SRT parser support.
- `supabase/functions/_shared/otter-parser.ts` — Otter parser support.
- `supabase/functions/_shared/vtt-parser.ts` — VTT parser support.
- `supabase/functions/_shared/fathom-transcript-parser.ts` — Fathom copy parser support.
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` — real-Supabase behavioral test target.
- `docs/architecture/transcript-formats.md` — canonical transcript shape and supported manual formats; must include Markdown if Phase 1 adds `.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PasteTranscriptModal.tsx`: already has preview parsing, mode selection, transcript-file selection, inline error state, and `save-pasted-transcript` invocation.
- `save-pasted-transcript/index.ts`: already has normalization branches for `zoom`, `srt`, `otter`, `loom`, `file-upload`, and `fathom-paste`.
- `_shared/loom-parser.ts`: Loom support is already present and should be validated, not rebuilt from scratch.
- `_shared/srt-parser.ts`, `_shared/otter-parser.ts`, `_shared/vtt-parser.ts`, `_shared/fathom-transcript-parser.ts`: parser modules to reuse/extend rather than replacing with ad hoc parsing.
- `docs/architecture/transcript-formats.md`: existing docs home for the canonical transcript JSON shape.

### Established Patterns
- Edge Functions authenticate with `authenticateRequest(req, supabase, corsHeaders)` from `_shared/auth.ts`.
- Manual transcript records flow through `runPipeline()` where possible so they land in the same routing/dedup path as connector imports.
- Frontend mutations that affect call lists should use `invalidateCallListCaches(queryClient)` or equivalent complete invalidation; partial invalidation risks stale UI.
- UI labels should avoid implying CallVault transcribes audio/video in v1. Use transcript-import language.
- Integration tests for this path must hit a real Supabase project and skip safely when credentials are absent.

### Integration Points
- Rename user-facing manual entry labels from Save/Paste Transcript toward `Import Transcript`.
- Remove or hide File Upload from `ImportPage`, import source panes, connector/source lists, onboarding cues, and empty states.
- Keep transcript-file input in the Import Transcript modal and extend accepted extensions to include `.md`.
- Verify existing Loom route through `source_app: "loom"` and `loom.com/share/` source URL detection.
- Update `docs/architecture/transcript-formats.md` to include Markdown `.md` behavior if implementation supports it.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants Loom included and believes it was already implemented by prior agents. Treat that as a verification/preservation requirement.
- The user wants `.md` included as a supported manual transcript file/input.
- The user chose `Import Transcript` as the user-facing label for the manual transcript entry point.
- The user is uncertain whether any real manual audio uploads exist; planning should verify before deleting compatibility code.

</specifics>

<deferred>
## Deferred Ideas

- Main sidebar/nav `Import` rename: consider if naturally touched by Phase 1 copy work, otherwise defer to Phase 6 launch UX/navigation polish.
- Audio/video file upload and async transcription pipeline remain v2 scope.
- Bulk transcript/audio upload remains v2 scope.

</deferred>

---

*Phase: 01-Paste Pipeline Polish*
*Context gathered: 2026-05-27*
