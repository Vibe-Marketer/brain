# Codebase Concerns

**Analysis Date:** 2026-05-27

---

## Tech Debt

**Uncommitted-files-as-real-code pattern (cascading Vercel build failures):**
- Issue: Multiple refactor commits shipped new files via in-tree imports without `git add`ing them. Vercel's build then failed because the tracked code referenced untracked files on disk. Required 4 emergency fix commits in a single day.
- Commits: `3965bf44` (sync-tab refactor deps), `be45100f` (7 more connector lib files), `2e91f332` (api-client.ts `completeConnectorOAuth` export), `9b6e3338` (source-registry.ts `oauthCallbackFunctionName` entries). Production crashed at runtime after `9b6e3338` because `OAUTH_CALLBACK_ROUTES` was empty.
- Files historically affected: `src/components/transcripts/syncSelection.ts`, `src/hooks/useSyncTabOrchestration.ts`, `src/hooks/useSyncTabStateBridge.ts`, `src/lib/integration-platforms.ts`, `src/components/connectors/connectorSearch.ts`, `src/lib/connector-availability.ts`, `src/lib/connector-capabilities.ts`, `src/lib/connector-sync-functions.ts`, `src/lib/import-source-flow.ts`, `src/lib/api-client.ts`, `src/config/source-registry.ts`
- Impact: Broken production deploys; runtime JS crashes with `OAUTH_CALLBACK_ROUTES is empty`; requires emergency fix commits.
- Fix approach: Run `git status --short | grep "^?"` before every commit during refactor work. Use `npm run build` locally (against the committed tree, not the working tree) before pushing. Consider a pre-push hook that runs `npm run build` on a clean `git stash` to catch untracked file gaps.

**`personal-folders.service.ts` stubs — migration shipped but service not wired:**
- Issue: `getPersonalFolders()` and `getPersonalFolderAssignments()` both return empty values unconditionally. The `personal_folders` migration (`20260306000000_personal_organization_and_home.sql`) exists and has RLS, but the service functions are no-ops guarded by the TODO comment. Feature is entirely dead in production.
- Files: `src/services/personal-folders.service.ts` (lines 20, 70)
- Impact: Personal folder UI is non-functional regardless of migration state.
- Fix approach: Remove the stub guards, implement the real queries, and add `personal_folders` / `personal_folder_recordings` to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts`.

**`tag_preferences` table missing `organization_id` (issue #173):**
- Issue: `auto-tag-calls` edge function fetches tag preferences scoped by `user_id` only. In a multi-org context, a user's tag preferences bleed across their organizations.
- Files: `supabase/functions/auto-tag-calls/index.ts` (line 85)
- Impact: Tag auto-application uses cross-org preferences — low blast radius today (single-org accounts), but will leak as multi-org usage grows.
- Fix approach: Migration to add `organization_id NOT NULL` to `tag_preferences`, backfill from `organization_memberships`, update the query at `auto-tag-calls/index.ts:86` to add `.eq('organization_id', organizationId)`.

**`sync-tab.service.ts` Phase 9 migration TODO — still reading from `fathom_calls`:**
- Issue: The sync tab list still reads from `fathom_calls` (legacy BIGINT-keyed table) rather than `recordings` (UUID-keyed canonical table). The comment at line 73 acknowledges this and defers to a future migration step.
- Files: `src/services/sync-tab.service.ts` (lines 73–83)
- Impact: The sync tab won't naturally show non-Fathom recordings (Zoom, Grain, Read.ai, manual imports) alongside Fathom ones until this migration completes.
- Fix approach: Add org-scoped branch in `getSyncTabCalls()` to read from `recordings` filtered by `organization_id`, paralleling the existing `fathom_calls` path.

**`last_login_at` column exists but is never written:**
- Issue: `user_profiles.last_login_at` (defined in `00000000000000_consolidated_schema.sql:31`) is always returned as `null` in admin/user-detail views. Both `AdminTab.tsx:137` and `UserDetailPanel.tsx:112` hardcode `last_login_at: null` in their data mapping. The sort in `useTableSort.ts:57` is effectively a no-op.
- Files: `src/components/settings/AdminTab.tsx`, `src/components/panels/UserDetailPanel.tsx`, `src/hooks/useTableSort.ts`
- Impact: "Last Login" UI column always shows blank; "Active Users" count in AdminTab always returns 0.
- Fix approach: Write `last_login_at = NOW()` from an `auth.users` trigger or from the `SessionStart` hook path in the frontend's `AuthContext.tsx`.

**`_shared/deduplication.ts` — dead code with no active importers:**
- Issue: The older synchronous deduplication helper has zero imports. `_shared/dedup-fingerprint.ts` notes this explicitly at line 9 ("the older synchronous implementation kept for reference").
- Files: `supabase/functions/_shared/deduplication.ts`
- Impact: Dead code — no runtime risk, but adds confusion when navigating the `_shared/` directory.
- Fix approach: Delete the file; it is superseded by `dedup-fingerprint.ts`.

**`YouTubeChatSection` deleted, reference left in component:**
- Issue: `YouTubeVideoDetailModal.tsx:27` has a comment noting the component was deleted and needs to be restored when AI chat is wired back. No timeline or tracking issue referenced.
- Files: `src/components/youtube/YouTubeVideoDetailModal.tsx` (line 27)
- Impact: YouTube video detail has no AI chat affordance. Low urgency but stale comment accumulates.

---

## Known Bugs

**`recordings.share_url` does not exist as a top-level column — resolveShareUrl workaround:**
- Symptoms: Manual-import (paste-transcript) recordings do not have a `share_url` column on the `recordings` table. The `supabase.ts` types for `fathom_raw_calls` and its views do carry `share_url`, but `recordings.Row` does not. Code that previously read `call.share_url` directly always returned `undefined` for paste-imported recordings, so the "Open source" button never appeared.
- Fix introduced: `src/lib/recording-source-url.ts` — `resolveShareUrl()` checks `call.share_url` first, then falls back to `source_metadata.share_url` and `source_metadata.source_url`.
- Commit: `10d15520`
- Fragile surface: Any new component that renders an "open in source" affordance and reads `call.share_url` directly (bypassing `resolveShareUrl`) will silently fail for paste-import recordings. No TypeScript error surfaces this because `share_url` does exist on `fathom_raw_calls`-typed objects.
- Files: `src/lib/recording-source-url.ts`, `src/components/call-detail/CallTranscriptTab.tsx`
- Fix approach: Add a lint rule or grep gate to catch direct `.share_url` access on recording objects; enforce `resolveShareUrl()` as the only permitted read path.

---

## Security Considerations

**Content Security Policy uses `unsafe-inline` and `unsafe-eval`:**
- Risk: The production CSP in `vercel.json` allows `script-src 'self' 'unsafe-inline' 'unsafe-eval'` and `style-src 'self' 'unsafe-inline'`. This effectively disables XSS protection for scripts and styles.
- Files: `vercel.json` (line 14)
- Current mitigation: `X-Frame-Options: DENY`, HSTS, `X-Content-Type-Options: nosniff` are all present. Supabase RLS + JWT auth gates actual data.
- Recommendations: Vite's Rollup build can emit a nonce-based CSP via `@unocss/transformer-attributify` or `vite-plugin-csp`. Removing `unsafe-eval` requires confirming no dynamic `eval()` in runtime dependencies. This is a hardening item, not an active exploit path.

**Wildcard CORS on MCP endpoints — intentional but requires ongoing vigilance:**
- Risk: `mcp-server`, `mcp-oauth-metadata`, and `mcp-oauth-register` use `getPublicCorsHeaders()` which returns `Access-Control-Allow-Origin: *`. This is documented and intentional (RFC 9728 / RFC 7591 require world-readable discovery endpoints) but creates a surface where any origin can call these functions.
- Files: `supabase/functions/_shared/cors.ts`, `supabase/functions/mcp-server/index.ts:1044`, `supabase/functions/mcp-oauth-metadata/index.ts:58`, `supabase/functions/mcp-oauth-register/index.ts:20`
- Current mitigation: All data-mutating endpoints inside `mcp-server` require a valid `mcp_tokens` bearer token; wildcard CORS applies only to the JSON-RPC envelope. Auth is enforced at the bearer-token layer per `supabase/functions/mcp-server/index.ts:1094`.
- Recommendations: Periodic audit to ensure no data-returning MCP tool is callable without a valid token. The wildcard is correct for discovery/registration but should never extend to session-cookie-based endpoints.

**Sentry DSN configured but no release tagging in the Vite plugin:**
- Risk: `src/lib/sentry.ts` does not set a `release` in `Sentry.init()`. The `sentry-deploy.yml` workflow creates releases by commit SHA after Vercel deploys, but the Vite source-map plugin (which runs during `npm run build`) also needs a matching `release` to associate uploaded maps with errors. Without it, Sentry errors show minified stack traces even though source maps are uploaded.
- Files: `src/lib/sentry.ts`, `vite.config.ts`, `.github/workflows/sentry-deploy.yml`
- Current mitigation: `SENTRY_AUTH_TOKEN` is set; source maps are uploaded via `sentryVitePlugin` and `filesToDeleteAfterUpload` strips them from the bundle. Release finalizing via `sentry-deploy.yml` is wired. The gap is the missing `release` option in `Sentry.init()`.
- Recommendations: Set `release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ?? 'dev'` in `Sentry.init()` and pass the same string to `sentryVitePlugin({ release: { name: ... } })` in `vite.config.ts`.

---

## Performance Bottlenecks

**File upload and transcript processing are synchronous in a single Edge Function request:**
- Problem: `file-upload-transcribe/index.ts` reads the entire file into memory, calls the Whisper API synchronously, then writes to Supabase — all within a single Deno.serve request. The 25MB file limit means a worst-case Whisper API call for a large audio file blocks the HTTP response for potentially 60–120 seconds. Supabase Edge Functions have a wall-clock execution limit.
- Files: `supabase/functions/file-upload-transcribe/index.ts`
- Cause: No async job queue; everything is inline in the request handler.
- Improvement path: Introduce a background job pattern — accept the upload, write to Supabase Storage, enqueue a processing job (e.g., via `embedding_queue` pattern or a pg_net call), return a job ID to the client. Poll or subscribe via Supabase Realtime for completion.

**`TranscriptsTab.tsx` is 1,397 lines with mixed concerns:**
- Problem: Single file handles list fetching, bulk selection, drag-and-drop, inline ID translation (`legacy_recording_id` joins), folder assignment, and pagination. Any change risks unintended side effects across 10+ responsibilities.
- Files: `src/components/transcripts/TranscriptsTab.tsx`
- Cause: Incremental growth without extraction.
- Improvement path: Extract bulk-action logic to `BulkActionService`, folder-assignment display to a dedicated hook, and pagination to `useTranscriptPagination`. Target <400 LOC per component per the CLAUDE.md conventions implied by the refactor history (e.g., `SyncTab 998→345 LOC`).

**`mcp-server/index.ts` is 3,921 lines — single monolith for all MCP tools:**
- Problem: Every MCP tool (search, list, summarize, export, share, etc.) lives in one 3,921-line file. Cold start latency increases with bundle size on Deno Deploy; changes anywhere risk breaking the whole MCP surface.
- Files: `supabase/functions/mcp-server/index.ts`
- Improvement path: Extract tool handlers into `supabase/functions/mcp-server/tools/` files, imported and registered in `index.ts`. Mirrors the `_shared/` pattern already used for utilities.

---

## Fragile Areas

**Dual recording-ID system (UUID vs legacy BIGINT):**
- Files: `src/lib/recording-ids.ts` (helpers), `src/CLAUDE.md` (constraints), `src/components/transcripts/TranscriptsTab.tsx` (direct legacy ID access at lines 934–950), `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` (hand-rolled `Number(c.recording_id)` coercions at lines 183–249), `src/components/dnd/DndCallProvider.tsx` (inline `parseInt` at lines 143, 153)
- Why fragile: Tables split between BIGINT-keyed (`fathom_calls`, `fathom_transcripts`, `folder_assignments.call_recording_id`) and UUID-keyed (`recordings`, `workspace_entries`, `call_tag_assignments`, `call_speakers`). Passing the wrong type fails with `invalid input syntax for type uuid`. Three components bypass the `@/lib/recording-ids` helpers and hand-roll type coercion — any of these will break silently for non-Fathom recordings (Zoom, Grain, Read.ai, paste-imports) where `legacy_recording_id` is `null`.
- Safe modification: All new code touching recording IDs must import `toRecordingUuid` / `toRecordingUuidBatch` from `@/lib/recording-ids`. Never use `parseInt()`, `Number()`, or string coercion on a recording ID directly.
- Test coverage: `supabase/CLAUDE.md` references a prior incident (Phase 30 / BUG-01) where a mocked test passed for the exact UUID/BIGINT bug that broke prod. Integration tests against real DB are required.

**`source-registry.ts` — `oauthCallbackFunctionName` entries were lost once already:**
- Files: `src/config/source-registry.ts`
- Why fragile: `9b6e3338` was committed specifically because the working-tree version had six `oauthCallbackFunctionName` declarations while the committed version had zero, causing `OAUTH_CALLBACK_ROUTES is empty` at runtime. The registry is a critical boot-time artifact — missing entries cause a hard React mount failure.
- Safe modification: After any refactor touching `source-registry.ts`, run `npm run build` against the committed tree and verify `OAUTH_CALLBACK_ROUTES.length > 0` in the browser console before pushing.

**`fathom_calls` as the read source for sync tab:**
- Files: `src/services/sync-tab.service.ts` (lines 73–83)
- Why fragile: Sync tab reads from `fathom_calls` (user_id-scoped, BIGINT keys) and cannot show recordings from other connectors. Any org-level filtering applied to the `recordings` table is invisible here. Adding multi-connector sync results to the sync tab requires the Phase 9 migration to be completed first.
- Test coverage: No integration test for sync tab data isolation.

---

## Scaling Limits

**Transcript upload: 10MB paste / 25MB file, no async queue:**
- Current capacity: 10MB for pasted transcripts (`src/components/import/PasteTranscriptModal.tsx:292`), 25MB for file uploads (`src/components/import/FileUploadDropzone.tsx:21`, `supabase/functions/file-upload-transcribe/index.ts:7`).
- Limit: Whisper API itself caps at 25MB. The synchronous edge function call will timeout on large files before Whisper returns if the function wall-clock limit is hit.
- Scaling path: S3/Supabase Storage pre-signed upload → async transcription job via queue table → Realtime notification to client.

**`mcp-server` cold start grows with bundle size:**
- Current capacity: 3,921-line single file; Deno Deploy cold starts scale with bundle parse time.
- Limit: No hard limit known, but MCP tool count has grown by ~15 tools over the last 8 weeks. At the current growth rate, cold starts will become noticeable within ~3 months.
- Scaling path: Extract tool modules as described under Performance Bottlenecks.

---

## Dependencies at Risk

**`framer-motion` vs `motion/react` naming constraint:**
- Risk: The codebase uses `motion/react` (the new package name), but `framer-motion` is explicitly banned. Any `npm install` of a third-party component that peer-depends on `framer-motion` will silently install the old package alongside `motion/react`, potentially causing version conflicts.
- Files: `src/CLAUDE.md` (anti-patterns section)
- Impact: Duplicate animation libraries; bundle bloat; subtle behavior differences.
- Migration plan: Run `npm ls framer-motion` before adding any new UI library dependency.

---

## Missing Critical Features

**`personal_folders` UI is fully stubbed — feature is non-functional:**
- Problem: `getPersonalFolders()` returns `[]` unconditionally; `getPersonalFolderAssignments()` returns `{}` unconditionally. The migration exists and has RLS. The UI is wired to the service but receives empty data.
- Blocks: Personal folder creation, assignment, and display.
- Files: `src/services/personal-folders.service.ts` (lines 20, 70)

**YouTube AI Chat is deleted with no replacement wired:**
- Problem: `YouTubeVideoDetailModal.tsx:27` records that `YouTubeChatSection` was deleted and needs to be restored when AI chat is re-wired. No replacement exists.
- Blocks: AI-assisted interaction with YouTube vault recordings.
- Files: `src/components/youtube/YouTubeVideoDetailModal.tsx`

---

## Test Coverage Gaps

**`personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings` not in `CROSS_ORG_TABLES`:**
- What's not tested: Cross-org RLS isolation for all four personal-folder/tag tables.
- Files: `src/test/rls-regression.test.ts` — `CROSS_ORG_TABLES` array covers 10 tables but omits these four.
- Risk: A misconfigured RLS policy on personal folder tables could leak one user's personal folders to another user in a shared org, or across orgs. The migration (`20260306000000_personal_organization_and_home.sql`) applies RLS but the regression test does not exercise it.
- Priority: High — these are user-owned data tables with a known isolation requirement.

**`mcp_tokens`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules` not in `CROSS_ORG_TABLES`:**
- What's not tested: Cross-org RLS for these user-facing tables added in later migrations.
- Files: `src/test/rls-regression.test.ts`; migrations: `20260310160000_mcp_tokens.sql`, `20260507083233_call_notes.sql`, `20260401140000_contact_folders.sql`, `20260228000002_create_import_sources.sql`, `20260228000003_create_import_routing_rules.sql`
- Risk: If any of these tables has a `USING (true)` policy or a `user_id`-only filter that doesn't account for org scoping, cross-org leakage would be undetected.
- Priority: Medium — add each to `CROSS_ORG_TABLES` with the appropriate `filterColumn` mapping.

**`save-pasted-transcript` edge function tests are source-artifact assertions, not behavioral:**
- What's not tested: The actual HTTP handler behavior of `save-pasted-transcript/index.ts` — auth rejection on bad JWT, deduplication enforcement, VTT parse path vs raw fallback, workspace membership gate. Tests only check source file contents for compliance invariants (LEGAL, PASTE-02, PASTE-03).
- Files: `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`
- Risk: A refactor that changes behavior without changing the source patterns tested (e.g., moves the auth check after the write, or removes dedup) would pass all existing tests.
- Priority: Medium — add integration tests that call the function over HTTP with a real Supabase DB (following the `.integration.test.ts` pattern from `supabase/CLAUDE.md`).

**Sync tab shows `fathom_calls` only — no test for non-Fathom recording visibility:**
- What's not tested: That a Zoom, Grain, Read.ai, or paste-imported recording appears in the sync tab list.
- Files: `src/services/sync-tab.service.ts`
- Risk: Phase 9 migration could be considered complete without actually surfacing non-Fathom recordings; no test would catch the gap.
- Priority: Low until the Phase 9 migration is scheduled.

---

*Concerns audit: 2026-05-27*
