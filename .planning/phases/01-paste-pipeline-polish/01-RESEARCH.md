# Phase 01 Research: Paste Pipeline Polish

**Phase:** 01 - Paste Pipeline Polish  
**Researched:** 2026-05-27  
**Status:** Research complete  

## Research Question

What does the planner need to know to produce executable plans for the refreshed Phase 1 context?

The fresh context changes the previous Phase 1 plan shape. Phase 1 is not only "add SRT/Otter and hide upload"; it must now plan for Loom preservation, Markdown `.md` support, best-effort/no-data-loss parsing, `Import Transcript` naming, audio/video upload removal, and real-Supabase behavioral verification.

## Current Implementation Snapshot

### Manual Transcript Modal

Primary file: `src/components/import/PasteTranscriptModal.tsx`

Current useful behavior:
- Has a Radix dialog-based one-shot manual transcript flow.
- Parses VTT, SRT, Otter, and Fathom client-side for preview.
- Has inline error state via `InlineError` and `mapApiError()`.
- Has a hidden file input for `.vtt`, `.txt`, and `.srt` transcript files.
- Invokes `save-pasted-transcript` with `source_app`, `raw_transcript`, `organization_id`, optional source URL, title, recorded date, and attendees.

Current gaps against fresh context:
- User-facing title/button/copy still says `Save a Transcript`, `Save Transcript`, and `Upload transcript file`; context wants `Import Transcript` language.
- `ManualTranscriptMode` lacks `loom` and Markdown-specific handling.
- File input does not accept `.md` or `text/markdown`.
- File helper copy lists VTT/SRT/TXT but not Markdown or Loom.
- Successful save invalidates only `queryKeys.calls.all` and `['workspace-entries']`; project rules prefer complete call-list invalidation via `invalidateCallListCaches(queryClient)`.
- Plain transcript is represented as `file-upload`, which is confusing now that audio/video file upload is hidden. Planning should consider a clearer internal mode if safe, or preserve compatibility while hiding user-facing `file-upload` language.

### Save Endpoint

Primary file: `supabase/functions/save-pasted-transcript/index.ts`

Current useful behavior:
- Authenticates through `authenticateRequest(req, supabase, corsHeaders)`.
- Validates body with Zod.
- Infers source type through `inferManualSourceApp()`.
- Supports `fathom-paste`, `zoom`, `srt`, `otter`, `loom`, and `file-upload`.
- Uses `runPipeline()` for new manual transcript inserts.
- Uses source metadata fields that preserve manual provenance: `source_platform`, `import_method: "manual"`, `parse_status`, speaker names, duration, and paste source.

Current gaps against fresh context:
- Zod enum does not include a Markdown-specific source value. Markdown can be handled as raw/plain text, but the plan must decide whether it remains `file-upload` compatibility or gets a clearer manual text mode.
- `inferManualSourceApp()` detects Loom only from URL, not from content or explicit modal mode.
- Best-effort/no-data-loss behavior is uneven: SRT and Zoom throw when parsed segments are empty; Otter can save raw when no segments exist. Fresh context wants raw fallback whenever possible.
- SRT/Zoom missing-speaker behavior uses `Unknown`, while docs/context prefer `Unknown Speaker`. Plan should either standardize output or explicitly preserve current detail UI expectations.
- Markdown `.md` support is not documented or validated.

### Loom Parser

Primary file: `supabase/functions/_shared/loom-parser.ts`

Current useful behavior:
- `isLoomUrl()` detects `loom.com/share/`.
- `extractLoomShareToken()` extracts the share ID.
- `parseLoomTranscript()` extracts timestamp-line-based segments.

Current gaps against fresh context:
- Default speaker is `Speaker 1`, but context says missing speakers should use `Unknown Speaker` unless reliably detected.
- Parser does not extract speaker labels if Loom transcript text includes them.
- No dedicated unit/integration test coverage was found in the main research scan.
- Frontend preview does not expose a Loom mode; Loom currently depends on the source URL and server-side inference.

### Existing Parsers

Relevant files:
- `supabase/functions/_shared/srt-parser.ts`
- `supabase/functions/_shared/otter-parser.ts`
- `supabase/functions/_shared/vtt-parser.ts`
- `supabase/functions/_shared/fathom-transcript-parser.ts`

Planner guidance:
- Reuse these modules. Do not introduce a separate parser framework for Phase 1.
- Add Markdown handling as a thin layer over the existing Fathom/plain-text parsing heuristics.
- Preserve raw text in `full_transcript` for all inputs.
- Parser changes should be covered by unit tests for pure parser behavior and integration tests for endpoint behavior.

### Audio/Video Upload UI

Relevant files:
- `src/pages/ImportPage.tsx`
- `src/components/import/FileUploadDropzone.tsx`
- `src/components/panes/ImportSourcePane.tsx`
- `src/components/onboarding/OnboardingModal.tsx`
- `src/components/connectors/registry/adapters/file-upload.ts`
- `src/lib/import-source-flow.ts`

Current useful behavior:
- `FileUploadDropzone.tsx` already has a MAN-06 comment saying it is hidden until v2 async transcription.
- Onboarding appears to already have an upload card removal comment.

Current gaps against fresh context:
- `ImportPage.tsx` still imports `FileUploadDropzone`.
- `ImportPage.tsx` still routes `sourceFlow === "file-upload"` to a File Upload page and renders `<FileUploadDropzone />`.
- `ImportPage.tsx` still has `Paste Transcript` and `Save Transcript` labels.
- `import-source-flow.ts` still classifies `file-upload` as a user-facing flow.
- `connectorRegistry.ts` still registers `fileUploadAdapter`; this can remain for compatibility if it is not surfaced.

## Planning Implications

### Replan Required

Existing plan files are not sufficient for the fresh context:
- `01-A-PLAN.md` focuses on SRT and Otter only; it does not cover Loom preservation, Markdown `.md`, or best-effort raw fallback across malformed structured inputs.
- `01-B-PLAN.md` covers real-Supabase tests but originally narrows format detection to VTT/Fathom in its goal, and must expand to Loom, Markdown/raw fallback, SRT, Otter, and permission/dedup behavior.
- `01-C-PLAN.md` uses old `Save Transcript` language and does not plan for `Import Transcript` naming or Markdown/Loom UX.
- `01-D-PLAN.md` keeps old assumptions about `source-registry.ts`; the current code scan shows `ImportPage.tsx` still directly renders `FileUploadDropzone`, so the plan must include that explicit removal path.

Recommended planning mode: replan from scratch or rewrite all four plans from current context. "Add more plans" would leave stale plan language and coverage gaps.

### Recommended Plan Split

Use four executable plans:

1. Parser contract and manual format support (MAN-02)
   - Best-effort/no-data-loss fallback.
   - Loom verification/preservation.
   - Markdown `.md` support.
   - SRT/Otter/VTT/Fathom/raw behavior aligned around speaker and timestamp rules.
   - Docs update in `docs/architecture/transcript-formats.md`.

2. Manual import UX and naming (MAN-05, MAN-02)
   - Rename visible entry point to `Import Transcript`.
   - Add `.md` file input support.
   - Keep transcript-file selection, but avoid audio/video upload language.
   - Ensure inline friendly errors and preview behavior match context.
   - Use Remix icons only.

3. Hide audio/video file-upload surfaces (MAN-06)
   - Remove direct `FileUploadDropzone` rendering from `ImportPage.tsx`.
   - Hide File Upload source cards/onboarding cues/empty-state CTAs.
   - Preserve internal compatibility for old `file-upload` records and in-flight callers.
   - Verify whether real `file-upload` rows exist before deleting any compatibility code.

4. Real-Supabase behavioral verification and build/browser proof (MAN-04, all Phase 1)
   - Real-Supabase HTTP integration tests.
   - Parser unit tests.
   - Build/typecheck.
   - Browser verification that audio/video upload is unreachable and Import Transcript works.

## Validation Architecture

### Automated Tests

Use existing Vitest infrastructure.

Required unit-level coverage:
- `supabase/functions/_shared/__tests__/srt-parser.test.ts`
- `supabase/functions/_shared/__tests__/otter-parser.test.ts`
- Add or extend tests for `loom-parser.ts` if not present.
- Add Markdown/raw fallback tests either near parser utilities or source-artifact tests for `save-pasted-transcript`.

Required endpoint-level coverage:
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts`
- Must use real Supabase credentials and skip safely when missing.
- Must not mock Supabase.
- Must cover:
  - no auth returns 401
  - invalid JWT returns 401
  - wrong org/workspace membership returns 403
  - dedup behavior
  - VTT, SRT, Otter TXT, Loom, Markdown, Fathom copy, raw fallback
  - malformed structured input saves raw when possible

Required source-regression checks:
- Existing source-artifact tests in `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` should be updated, not removed, to guard allowed source modes and Loom/Markdown handling.

### UI Verification

Required browser verification:
- `/import` or current import surface exposes `Import Transcript`, not `Save Transcript`/`Paste Transcript` as the primary entry point.
- Audio/video File Upload page/dropzone is not reachable through user-facing UI.
- Transcript file chooser accepts `.vtt`, `.srt`, `.txt`, and `.md`.
- Pasting/choosing a transcript with parseable turns shows preview.
- Invalid/malformed content has a friendly inline state and does not produce a stack trace.

### Build/Static Verification

Required commands:
- `npm run build`
- Relevant Vitest command for parser/source tests.
- Real-Supabase integration test command when credentials are available; otherwise the test must report skipped due to missing env.

### Manual/Database Verification

Before deleting compatibility code, verify whether `recordings` or `import_sources` contain `source_app = 'file-upload'`. If credentials are unavailable, plans should require a source/code compatibility-preservation approach rather than deletion.

## Threat Model

### T-01: User Data Loss From Strict Parser Failure

Risk: malformed VTT/SRT/Otter/Markdown transcript is rejected or saved without raw body.  
Mitigation: parser contract is best-effort first, raw fallback second. `full_transcript` remains the source of truth when structure cannot be derived.

### T-02: Misattributed Speakers

Risk: aggressive speaker inference assigns transcript turns to the wrong person.  
Mitigation: use detected speaker labels only; use `Unknown Speaker` when labels are absent.

### T-03: Audio/Video Upload UX Misrepresentation

Risk: UI implies CallVault will transcribe audio/video in v1 even though async transcription is deferred.  
Mitigation: remove audio/video upload entry points and use transcript-import copy only.

### T-04: Compatibility Breakage For Old `file-upload` Rows

Risk: removing registry/adapter/source labels breaks existing recordings or in-flight callers.  
Mitigation: hide from user-facing surfaces while preserving internal source handling unless database verification proves deletion is safe.

### T-05: False Test Confidence From Mocked Supabase

Risk: mocked tests pass while real UUID/BIGINT, RLS, auth, or Edge Function behavior fails.  
Mitigation: MAN-04 requires HTTP-level real-Supabase tests; mocked Supabase tests are not acceptable for this path.

## Open Issues For Planner

- No UI-SPEC exists for this frontend-heavy phase. The plan workflow should stop for `$gsd-ui-phase 1` unless operator reruns with `--skip-ui`.
- The repo currently has many unrelated dirty files; plans should name only Phase 1 files and avoid relying on unrelated worktree state.
- The existing plan files should be replaced rather than extended, because they do not cover the fresh context.

## RESEARCH COMPLETE
