# Phase 1: Paste Pipeline Polish - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 22
**Analogs found:** 22 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/import/PasteTranscriptModal.tsx` | component | event-driven | `src/components/import/__tests__/PasteTranscriptModal.test.tsx` | exact |
| `src/pages/ImportPage.tsx` | component | request-response | `src/pages/__tests__/ImportPage.connector-routing.test.ts` | exact |
| `src/components/import/FileUploadDropzone.tsx` | component | event-driven | `src/components/import/FileUploadDropzone.tsx` | exact |
| `src/components/panes/ImportSourcePane.tsx` | component | event-driven | `src/components/panes/__tests__/ImportSourcePane.registry.test.ts` | role-match |
| `src/components/onboarding/OnboardingModal.tsx` | component | event-driven | `src/lib/__tests__/onboarding-connectors.test.ts` | role-match |
| `src/config/source-registry.ts` | config | transform | `src/components/connectors/registry/__tests__/connectorRegistry.test.ts` | exact |
| `src/lib/import-source-flow.ts` | utility | transform | `src/lib/__tests__/import-source-flow.test.ts` | exact |
| `src/components/connectors/registry/adapters/file-upload.ts` | config | transform | `src/components/connectors/registry/__tests__/connectorRegistry.test.ts` | exact |
| `supabase/functions/save-pasted-transcript/index.ts` | service | request-response | `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | exact |
| `supabase/functions/_shared/loom-parser.ts` | utility | transform | `supabase/functions/_shared/fathom-transcript-parser.ts` | role-match |
| `supabase/functions/_shared/srt-parser.ts` | utility | transform | `supabase/functions/_shared/vtt-parser.ts` | role-match |
| `supabase/functions/_shared/otter-parser.ts` | utility | transform | `supabase/functions/_shared/fathom-transcript-parser.ts` | role-match |
| `supabase/functions/_shared/vtt-parser.ts` | utility | transform | `supabase/functions/_shared/fathom-transcript-parser.ts` | role-match |
| `supabase/functions/_shared/fathom-transcript-parser.ts` | utility | transform | `supabase/functions/_shared/fathom-transcript-parser.ts` | exact |
| `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` | test | request-response | `supabase/functions/share-call/__tests__/share-call.integration.test.ts` | role-match |
| `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | test | transform | `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | exact |
| `src/lib/__tests__/import-source-flow.test.ts` | test | transform | `src/lib/__tests__/import-source-flow.test.ts` | exact |
| `src/lib/__tests__/onboarding-connectors.test.ts` | test | transform | `src/lib/__tests__/onboarding-connectors.test.ts` | exact |
| `src/components/panes/__tests__/ImportSourcePane.registry.test.ts` | test | transform | `src/components/panes/__tests__/ImportSourcePane.registry.test.ts` | exact |
| `src/components/import/__tests__/FailedImportsSection.registry.test.ts` | test | transform | `src/components/import/__tests__/FailedImportsSection.registry.test.ts` | exact |
| `src/components/import/__tests__/PasteTranscriptModal.test.tsx` | test | request-response | `src/components/import/__tests__/PasteTranscriptModal.test.tsx` | exact |
| `src/pages/__tests__/ImportPage.connector-routing.test.ts` | test | request-response | `src/pages/__tests__/ImportPage.connector-routing.test.ts` | exact |
| `docs/architecture/transcript-formats.md` | config | transform | `docs/architecture/transcript-formats.md` | exact |

## Pattern Assignments

### `src/components/import/PasteTranscriptModal.tsx` (component, event-driven)

**Analog:** `src/components/import/__tests__/PasteTranscriptModal.test.tsx`

**Use the modal save flow pattern** from `src/components/import/PasteTranscriptModal.tsx` lines 137-380: one-shot dialog state, live preview, inline error mapping, and a single submit path that closes only after success. Preserve the current flow shape from the test at lines 77-306, especially the `save-pasted-transcript` invoke body and the success navigation to `/?callId=<id>`.

**Copy these behaviors:**
`useMemo` parsing on textarea updates, `mapApiError(status, ...)` for 401/403/409/400, and the submit guard that requires `MIN_TRANSCRIPT_CHARS` before invoking the edge function.

**Do not change the save contract accidentally:** the current UI sends `source_app`, `raw_transcript`, `organization_id`, optional source URL, and optional overrides, then invalidates the calls cache on success.

### `src/pages/ImportPage.tsx` (component, request-response)

**Analog:** `src/pages/__tests__/ImportPage.connector-routing.test.ts`

**Copy the page-level dispatch pattern** from `src/pages/ImportPage.tsx` lines 130-284: a single `renderPane3()` switch on `getImportSourceFlow(selectedSource)`, connector wizard first, then public URL, file-upload, routing rules, import history, and paste-transcript branches. The test at lines 7-29 documents the source-routing invariants that need to stay stable.

**Important current details to preserve or move:** the page still owns the floating paste CTA, the File Upload branch, the Paste Transcript branch, and the OAuth-return redirect handling that calls `upsertImportSource(...)` and `invalidateConnectorQueries(queryClient, connectedSource)`.

### `src/components/import/FileUploadDropzone.tsx` (component, event-driven)

**Analog:** `src/components/import/FileUploadDropzone.tsx`

**This file is already the hidden-by-design reference**. The header comment at lines 1-13 is the pattern to preserve if the file remains in the tree: it should stay marked as hidden until v2 and should not be imported into v1 UI surfaces.

**Copy the guardrail shape only if needed:** the MIME allowlist, 25MB cap, and explicit hidden-state messaging at lines 20-35 and 127-167. If the component is left in place, keep the user-facing copy out of visible import flows.

### `src/components/panes/ImportSourcePane.tsx` (component, event-driven)

**Analog:** `src/components/panes/__tests__/ImportSourcePane.registry.test.ts`

**Use the registry-driven source list pattern** from `src/components/panes/ImportSourcePane.tsx` lines 50-160: `VISIBLE_SOURCE_REGISTRY.map(...)` for primary sources, `SelectionButton` for each source row, and shared `isConnectorAlwaysAvailable(...)` for the connected badge state. The test at lines 10-25 verifies that the pane does not hard-code `file-upload` branches.

**When removing upload surfaces, keep the registry source of truth intact.** This pane should inherit visibility from `src/config/source-registry.ts` instead of duplicating local filters.

### `src/components/onboarding/OnboardingModal.tsx` (component, event-driven)

**Analog:** `src/lib/__tests__/onboarding-connectors.test.ts`

**Keep the onboarding source selection flow aligned with shared connector metadata.** The removal comment at `src/components/onboarding/OnboardingModal.tsx` lines 306-307 is the current pattern for hiding the upload card. The test at lines 8-24 proves that `file-upload` stays out of onboarding connector choices.

**Reuse the current onboarding posture:** connect existing sources, do not reintroduce upload language, and keep the skip/tour path separate from the import surface.

### `src/config/source-registry.ts` (config, transform)

**Analog:** `src/components/connectors/registry/__tests__/connectorRegistry.test.ts`

**This registry is the canonical source list.** The current `uiVisible: false` pattern at lines 222-245 is the exact mechanism to reuse for hiding source rows without deleting internal compatibility. The registry test at lines 121-193 proves the registry and adapter metadata stay aligned.

**Copy the current source-entry shape:** `id`, `label`, `subtitle`, `icon`, `adapter`, `authMode`, `hasWebhook`, `status`, and `uiVisible` are the fields that drive visibility and labeling across the import UI.

### `src/lib/import-source-flow.ts` (utility, transform)

**Analog:** `src/lib/__tests__/import-source-flow.test.ts`

**Keep the flow classifier as a pure string-to-flow mapper.** The current logic at lines 19-40 is the reference: source config comes from `tryGetSourceConfig`, connectors route to `connector-wizard`, `youtube` routes to `public-url`, and `file-upload` / `paste-transcript` stay explicit branches. The test at lines 8-38 is the contract to preserve.

**Do not collapse compatibility branches into a single generic upload flow.** The phase wants user-facing removal, not a hidden semantic change for existing source ids.

### `src/components/connectors/registry/adapters/file-upload.ts` (config, transform)

**Analog:** `src/components/connectors/registry/__tests__/connectorRegistry.test.ts`

**Preserve the no-auth adapter pattern.** The current adapter at lines 10-28 is a minimal metadata object with `authMethods: ["none"]` and helper copy that explains the direct upload path. The registry test at lines 176-193 confirms `file-upload` remains a `none` setup kind.

**If the source becomes hidden-only, keep the adapter internal and do not delete it just to clean up labels.**

### `supabase/functions/save-pasted-transcript/index.ts` (service, request-response)

**Analog:** `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`

**This edge function is the main behavioral contract.** The current source-regression test at lines 45-298 is the strongest analog because it pins the auth order, dedup key, raw-fallback path, and parser wiring. In the handler itself, keep the sequence from lines 74-176: CORS, shared auth helper, Zod validation, org membership check, then normalization.

**Copy the current parser branch pattern:** `normalizeManualTranscript()` dispatches by `sourceApp` at lines 415-420, with dedicated `normalizeZoomVtt`, `normalizeSrt`, `normalizeOtter`, `normalizeLoom`, and `normalizeFathomPaste` paths. That is the shape the planner should preserve while expanding best-effort fallback.

**Key guardrails already present:** the handler uses `authenticateRequest(req, supabase, corsHeaders)`, validates with `inputSchema.safeParse(rawBody)`, dedups by `(organization_id, share_token)`, and sends manual transcripts through `runPipeline(...)` when no existing row is found.

### `supabase/functions/_shared/loom-parser.ts` (utility, transform)

**Analog:** `supabase/functions/_shared/fathom-transcript-parser.ts`

**Use the same best-effort parser posture as the Fathom parser.** The current Loom parser at lines 7-59 is intentionally small: URL detection, share-token extraction, time-line parsing, and a raw fallback when no segments are found. The closest contract match is the Fathom parser at lines 317-419, which explicitly returns `parse_status: 'raw'` instead of throwing when the format is not parseable.

**Current details to preserve or refine:** `isLoomUrl(...)`, `extractLoomShareToken(...)`, and the `parse_status`/`segments` return shape.

### `supabase/functions/_shared/srt-parser.ts` (utility, transform)

**Analog:** `supabase/functions/_shared/vtt-parser.ts`

**Keep the cue-based parser shape.** The SRT parser at lines 32-154 already does the right high-level work: `isSrtContent(...)`, `srtTimestampToSeconds(...)`, `extractSpeaker(...)`, and `parseSRT(...)` that produces structured segments plus `full_text` and duration. The VTT parser at lines 29-118 is the closest style match for timestamp cue parsing and speaker extraction.

**For Phase 1, preserve raw fallback and `Unknown Speaker` semantics when cues are incomplete.**

### `supabase/functions/_shared/otter-parser.ts` (utility, transform)

**Analog:** `supabase/functions/_shared/fathom-transcript-parser.ts`

**Keep the dense-speaker-text heuristic pattern.** The Otter parser at lines 42-120 already uses branding detection plus `Speaker Name: text` matching and returns `full_text`, `speakers`, and optional `title`. The Fathom parser is the closest contract match for the fallback behavior because it treats a non-parseable input as raw instead of failing hard.

**The planner should preserve sequential turn order and raw preservation, not add a separate parsing framework.**

### `supabase/functions/_shared/vtt-parser.ts` (utility, transform)

**Analog:** `supabase/functions/_shared/fathom-transcript-parser.ts`

**Use this as the canonical cue parser style.** The VTT parser at lines 29-118 handles the standard cue loop, speaker extraction, tag cleanup, and timestamp normalization. The Fathom parser is the closest shared pattern for raw fallback and multi-line turn handling.

**The Phase 1 change surface should keep this module as the Zoom/VTT parser baseline and only extend it where needed for speaker defaults or detection parity.**

### `supabase/functions/_shared/fathom-transcript-parser.ts` (utility, transform)

**Analog:** `supabase/functions/_shared/fathom-transcript-parser.ts`

**This is the parser contract anchor.** Lines 317-419 show the load-bearing behavior the manual import flow already depends on: detect by timestamped speaker turns, join multi-line turns, union attendees, and return `parse_status: 'raw'` when the content does not meet the threshold.

**Copy the no-data-loss posture:** the parser explicitly tells callers to save `rawText` into `full_transcript` when parsing is not possible.

### `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` (test, request-response)

**Analog:** `supabase/functions/share-call/__tests__/share-call.integration.test.ts`

**Use the real-Supabase integration shape from the share-call test at lines 24-254.** That file demonstrates the environment-gated skip pattern, seeded fixture setup, real fetch calls, and response assertions against a deployed edge function. The pasted-transcript integration file already follows the same pattern at lines 20-249 and should stay real-DB only.

**The Phase 1 coverage target remains the same:** auth rejection, membership rejection, VTT/SRT/Otter/Fathom/raw format handling, dedup, and input validation without mocking Supabase.

### `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` (test, transform)

**Analog:** `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`

**This source-regression test is the strongest guardrail for the edge function.** It already pins the auth helper, the `share_token` dedup lookup, the raw `full_transcript` fallback, the `runPipeline(...)` call, and the explicit parser dispatch for SRT, Otter, and Loom.

**Keep the current assertions around source text, not behavior mocks.** The file should continue to assert source shape for `authenticateRequest`, `inputSchema.safeParse`, `eq("organization_id", organization_id)`, and the parser branch list.

### `src/lib/__tests__/import-source-flow.test.ts` (test, transform)

**Analog:** `src/lib/__tests__/import-source-flow.test.ts`

**This test is the contract for the source-flow mapper.** It currently asserts the exact mapping for `file-upload`, `paste-transcript`, routing rules, import history, and unknown values. Keep it in sync with `src/lib/import-source-flow.ts` if any flow names change.

**The important invariant is compatibility, not a generic rewrite.**

### `src/lib/__tests__/onboarding-connectors.test.ts` (test, transform)

**Analog:** `src/lib/__tests__/onboarding-connectors.test.ts`

**This test already expresses the hidden-source rule for onboarding.** It keeps `file-upload` and `paste-transcript` out of onboarding connector choices. That is the guardrail to preserve while removing upload cues from the modal.

### `src/components/panes/__tests__/ImportSourcePane.registry.test.ts` (test, transform)

**Analog:** `src/components/panes/__tests__/ImportSourcePane.registry.test.ts`

**This test confirms the pane is registry-driven and does not branch locally on `file-upload`.** Keep the `SOURCE_REGISTRY.map` assertion and the `isConnectorAlwaysAvailable` check so the pane continues to inherit visibility from config.

### `src/components/import/__tests__/FailedImportsSection.registry.test.ts` (test, transform)

**Analog:** `src/components/import/__tests__/FailedImportsSection.registry.test.ts`

**This test keeps retry labels and source labels centralized.** It already blocks local `file-upload` branching and requires shared `getSourceLabel(...)` / `canRetryFailedImport(...)` helpers. That is the pattern to preserve while import labels change.

### `src/components/import/__tests__/PasteTranscriptModal.test.tsx` (test, request-response)

**Analog:** `src/components/import/__tests__/PasteTranscriptModal.test.tsx`

**This test is the behavioral UI contract for the modal.** It covers disabled submit state, live preview, friendly raw-paste warning, `save-pasted-transcript` invocation, Zoom VTT handling, and success navigation. Update it in lockstep with any `Import Transcript` copy or `.md` file-input changes.

### `src/pages/__tests__/ImportPage.connector-routing.test.ts` (test, request-response)

**Analog:** `src/pages/__tests__/ImportPage.connector-routing.test.ts`

**This source-regression test protects the page routing contract.** It checks the connector wizard path, OAuth return handling, `getImportSourceFlow(selectedSource)`, and centralized sync dispatch. Use it as the guardrail while removing visible upload entry points from the page.

### `docs/architecture/transcript-formats.md` (config, transform)

**Analog:** `docs/architecture/transcript-formats.md`

**This doc is the canonical format contract.** Lines 7-60 already describe the supported manual formats, raw fallback, and the no-data-loss rule. Phase 1 should extend the supported formats section for Markdown `.md` and keep the Loom, SRT, Otter, VTT, Fathom, and raw entries aligned with the code.

**The planner should treat this as the prose mirror of `save-pasted-transcript` and the shared parsers.**

## Shared Patterns

### Shared auth and validation for Edge Functions

**Source:** `supabase/functions/save-pasted-transcript/index.ts` and `supabase/functions/_shared/auth.ts`

Use the current sequence: build `supabase` from env, call `authenticateRequest(req, supabase, corsHeaders)`, then parse with Zod before any write. The source-regression test already asserts this order, so keep the handler structure stable.

### Best-effort parsing with raw fallback

**Source:** `supabase/functions/_shared/fathom-transcript-parser.ts`, `supabase/functions/_shared/loom-parser.ts`, `supabase/functions/_shared/srt-parser.ts`, `supabase/functions/_shared/otter-parser.ts`, `supabase/functions/_shared/vtt-parser.ts`

The shared parser posture is "parse what you can, preserve the raw text when you cannot". Fathom already documents this explicitly, Loom already returns raw on empty input, and the docs file already says `full_transcript` is the fallback store.

### Source visibility and hidden upload surfaces

**Source:** `src/config/source-registry.ts`, `src/lib/import-source-flow.ts`, `src/components/onboarding/OnboardingModal.tsx`

Keep `file-upload` and `paste-transcript` as internal-compatible ids, but hide user-facing upload entry points through `uiVisible: false`, flow classification, and onboarding removal comments. The planner should not delete compatibility first; it should hide visible surfaces first and verify old-row compatibility before trimming anything further.

### Registry-driven import panes

**Source:** `src/components/panes/ImportSourcePane.tsx`, `src/components/panes/__tests__/ImportSourcePane.registry.test.ts`, `src/components/connectors/registry/__tests__/connectorRegistry.test.ts`

The pane and connector registry both derive visible choices from shared registry data. Do not duplicate `file-upload` filtering locally. Keep all source lists tied to `SOURCE_REGISTRY` / `VISIBLE_SOURCE_REGISTRY`.

### Real-Supabase test discipline

**Source:** `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts`, `supabase/functions/share-call/__tests__/share-call.integration.test.ts`

Use the environment-gated skip pattern for integration tests and hit the real Supabase project. Mocked Supabase would miss auth, RLS, UUID/BIGINT, and edge-function behavior.

### Copy and label changes

**Source:** `src/pages/ImportPage.tsx`, `src/components/import/PasteTranscriptModal.tsx`, `src/config/source-registry.ts`

The current user-facing labels still say `Save Transcript`, `Paste Transcript`, and `File Upload`. Phase 1 should move those surfaces to `Import Transcript` language and remove audio/video upload copy without replacing it with a new upload CTA.

## Metadata

**Analog search scope:** `src/`, `supabase/functions/`, `docs/`
**Files scanned:** 30+
**Pattern extraction date:** 2026-05-27
