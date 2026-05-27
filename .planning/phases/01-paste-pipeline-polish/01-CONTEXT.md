# Phase 1: Paste Pipeline Polish - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The paste path is the polished v1 manual import — every common transcript format parses correctly (VTT, SRT, Otter TXT, Fathom copy, raw), the parser is guarded by real-DB integration tests, failures surface with friendly messages in the modal, and the file-upload entry points (audio upload via `file-upload-transcribe`) are hidden from the UI to set the right expectations. The `.vtt/.txt` transcript file upload button inside PasteTranscriptModal is NOT removed — it is a transcript text helper, not the audio upload path.

</domain>

<decisions>
## Implementation Decisions

### Format Detection & Parsing
- SRT detection: regex on `^\d+\n\d{2}:\d{2}:\d{2},\d{3} -->` (SRT numeric cue + comma timestamp separates it from VTT)
- SRT parser location: `supabase/functions/_shared/srt-parser.ts` — mirrors the VTT parser module pattern
- Otter detection: heuristic — `Otter.ai` header string OR dense `Speaker: text` lines without SRT/VTT timestamps
- Otter output format: same `[HH:MM:SS] Speaker: text` turn format as Fathom/Zoom paths (consistency)

### Friendly Error UX
- Error display strategy: inline error banner ABOVE the Save button (user is still in modal, can correct input — not toast-only)
- Dedup hit message: "This transcript was already imported. It's in your vault — no action needed." + "View it" link to existing recording
- Bad format message: "We couldn't parse this format. Your transcript was saved as plain text — you can edit the title and date." (soft warning, not a blocker)
- Network/server error: "Failed to save transcript. Please try again or contact support." with raw error detail in a collapsed "Details" toggle

### FileUploadDropzone Removal Scope
- Removal strategy: comment-out / conditional-hide FileUploadDropzone.tsx (not delete) — `file-upload-transcribe` Edge Function stays deployed; UI simply no longer imports or renders the component
- Surfaces to remove from: ImportSourcePane ("Upload a file" entry point), source-registry.ts (hide file-upload source from connector list), OnboardingModal file-upload step, any empty-state CTA referencing file upload
- PasteTranscriptModal "Upload transcript file" button: KEEP — this is `.vtt/.txt` transcript text input, NOT the `file-upload-transcribe` audio path
- Build verification: run `npm run build` and confirm zero dead-import errors before committing

### Integration Test Architecture
- Test approach: behavioral HTTP-level tests against a real Supabase test project (NO mocked Supabase — BUG-01 / CONCERNS Phase 30 precedent is binding)
- Test file location: `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` (separate from existing source-artifact inspection test)
- Test coverage: auth rejection (no JWT), workspace membership gate (wrong org), dedup enforcement (same share URL twice), format detection for VTT and Fathom only (SRT/Otter integration tests deferred until parsers are proven), and success path for each covered format
- CI gate: integration tests in a dedicated `npm run test:integration` script, env-var gated (skip without Supabase credentials)

### Agent's Discretion
- Exact Otter.ai heuristic thresholds (number of `Speaker: text` lines to confirm format)
- Error banner visual design (color, icon, exact placement within modal layout)
- Whether to add SRT/Otter format options to the PasteTranscriptModal `mode` select, or auto-detect silently

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/_shared/vtt-parser.ts` — VTT parser to mirror for SRT parser structure
- `supabase/functions/_shared/fathom-transcript-parser.ts` — Fathom copy-format parser
- `src/components/import/PasteTranscriptModal.tsx` — existing modal to add error UX to
- `src/components/import/FileUploadDropzone.tsx` — component to hide (not delete)
- `src/config/source-registry.ts` — connector registry to remove file-upload entry from
- `src/components/connectors/registry/adapters/file-upload.ts` — adapter to deactivate
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` — existing source-artifact tests (do not break)

### Established Patterns
- Parser structure: export `parseXXX(content: string): ParsedTranscript` + named segment interfaces (see vtt-parser.ts)
- Error handling in Edge Functions: catch + `new Response(JSON.stringify({ error }), { status: 4xx })` 
- Frontend errors: `toast.error()` from sonner + inline state messages for form-level errors
- Test pattern: Vitest + `readFileSync` source inspection for behavioral invariants
- Integration test gate: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars required

### Integration Points
- `save-pasted-transcript/index.ts` — add `normalizeXXX` functions for SRT + Otter paths + extend `inferManualSourceApp()` detection
- `PasteTranscriptModal.tsx` — add `errorMessage` state + inline error banner + friendly error mapping
- `src/config/source-registry.ts` — remove or hide file-upload source entry
- `supabase/functions/_shared/` — add `srt-parser.ts`
- `docs/architecture/transcript-formats.md` — new doc for canonical CallVault transcript JSON shape

</code_context>

<specifics>
## Specific Ideas

- The existing tests in `save-pasted-transcript.test.ts` inspect source artifacts (no Supabase needed). The new integration test file is a separate concern and should not replace those tests.
- SRT integration test: defer to after SRT parser is proven via unit tests first.
- The "Upload transcript file" button in PasteTranscriptModal (`.vtt/.txt` files only) is explicitly KEPT — it is not the audio upload path.

</specifics>

<deferred>
## Deferred Ideas

- SRT/Otter behavioral integration tests (HTTP-level against Supabase) — deferred until parsers are proven via unit tests. Can be added in a follow-up within this phase if time allows.
- Bulk upload of multiple transcript files — v2 scope (MAN-V2-01).
- Mintlify docs search integration in support popout — Phase 6 scope.

</deferred>
