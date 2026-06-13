# Research Summary — CallVault Self-Serve Public Launch Milestone

**Synthesized:** 2026-05-27
**Inputs:** 2 targeted research files (MCP multi-workspace, async transcription pipeline) + codebase map
**Confidence:** HIGH on both research files; both verified against current vendor docs and existing code paths.

---

## Scope of This Research

Targeted research executed on 2 of the 4 workstreams:

- ✓ **Workstream 4** (Multi-MCP per-workspace + monolith refactor + new AI write tools) — `.planning/research/MCP-MULTI-WORKSPACE.md`
- ✓ **Workstream 3** (Async transcription pipeline + format support) — `.planning/research/ASYNC-TRANSCRIPTION-PIPELINE.md`

Workstreams 1 (Onboarding) and 2 (Connector reliability) did NOT receive targeted research — they're constrained by existing patterns in the codebase, not by an open architecture question. For those, the roadmapper should pull from:

- `.planning/codebase/ARCHITECTURE.md` — AppShell 4-pane layout, service+hook separation, query-key factory, `invalidateCallListCaches()` pattern
- `.planning/codebase/INTEGRATIONS.md` — all 7 connector OAuth/webhook/sync function inventories, Polar billing wiring
- `.planning/codebase/CONCERNS.md` — fragile surfaces that bind both workstreams: dual recording-ID system (UUID vs BIGINT — `parseInt`/`Number` banned), `source-registry.ts` `oauthCallbackFunctionName` boot artifact, `recordings.share_url` non-column quirk requiring `resolveShareUrl()`, sync-tab still on `fathom_calls`, `tag_preferences` missing `organization_id`

---

## Workstream 3 — Async Transcription Pipeline

**Recommended architecture:**
Browser uploads direct-to-Storage via signed upload tokens (single-shot for ≤6MB, TUS resumable via `tus-js-client` for >6MB up to 2GB). A thin `enqueue-transcribe-job` Edge Function inserts a `transcription_jobs` row and `pgmq_public.send()`s the job. A `pg_cron`-scheduled `transcribe-worker` Edge Function reads pgmq (5-min visibility timeout, `n=3` per tick), routes to **Whisper for ≤25MB native formats** ($0.006/min, already wired) and **Deepgram Nova-3 callback mode for >25MB or opus/ogg/flac/aac** ($0.0218/min, 2GB cap, unbounded duration). A Postgres trigger on `recordings` calls `realtime.broadcast_changes()` on a per-workspace private topic; client subscribes and invalidates TanStack Query caches. DLQ via `read_ct >= 3` check inside the worker. **No Redis, no SQS, no ffmpeg.wasm, no Docker** — entirely inside the existing stack.

**Key technical decisions:**

- **pgmq (Supabase Queues GA) over hand-rolled job table** — visibility timeout, retry tracking, exactly-once-within-window all already implemented. Hand-rolled racing two cron runs on the same row is the failure mode pgmq specifically prevents.
- **Direct-to-Storage upload (TUS) over routing bytes through Edge Function** — eliminates the wall-clock ceiling at the upload stage. Edge Function only issues a signed token (~50 LOC, <200ms). 6MB chunk size is **mandatory** per Supabase; do not change.
- **Provider routing over chunking** — Deepgram natively accepts opus/ogg/flac and handles multi-hour audio via callback. Chunking via ffmpeg.wasm would require 25-40MB bundle bloat, OOM risk in isolates, and would eat the very wall-clock budget you just freed.
- **Deepgram callback mode (not sync)** for >25MB — worker fires-and-archives; Deepgram POSTs result to a separate `deepgram-callback` Edge Function which writes via existing `runPipeline()`. Sidesteps the 10-min Deepgram sync ceiling.
- **Broadcast from Database (`realtime.broadcast_changes()`) over `postgres_changes`** — Supabase officially recommends this; scales without per-subscriber replication slot pressure. Single websocket per session covers all events for the active workspace.
- **`transcription_jobs` table is non-optional** — without a persisted job row, failures vanish silently. Source of truth for the "Transcribing…" placeholder row in the UI and for MAN-05 retry button.
- **Server-side magic-byte validation stays** — move existing `validateMagicBytes()` logic from `file-upload-transcribe` into the worker, against the file in Storage. Never trust client-supplied MIME/size.
- **`subtitle` npm library (via `npm:subtitle@4.2.2`)** for SRT + VTT parsing — Deno-compatible, covers both formats. Existing `_shared/vtt-parser.ts` can be deprecated after side-by-side pass. Otter TXT needs ~30-LOC custom parser (no public Otter JSON format exists).
- **Storage lifecycle: delete `uploads/*` 7 days after recording row written.** Audio is ephemeral; transcript is the long-lived artifact.

**Suggested phase ordering inside Workstream 3:**

1. **Foundation: `uploads` bucket + RLS + `transcription_jobs` table + pgmq queue setup** — pure infra migration, no behavior change. Establishes the substrate everything else writes against. Add cron sweeper for stuck jobs.
2. **Enqueue path: `file-upload-init` Edge Function (issues signed token) + thin `enqueue-transcribe-job`** — frontend `FileUploadDropzone.tsx` switches from synchronous `file-upload-transcribe` invocation to a two-step flow (init → upload to Storage → enqueue). At end of phase, file uploads no longer block on transcription; users see "Transcribing…" placeholder.
3. **Worker + Whisper happy path** — `transcribe-worker` Edge Function, reads pgmq, downloads from Storage, calls Whisper for ≤25MB. Wires `runPipeline()`. End state: existing 25MB Whisper functionality preserved but async; 25MB ceiling NOT yet lifted.
4. **Deepgram callback path for >25MB and non-Whisper formats** — adds `transcribeWithDeepgram()` + `deepgram-callback` Edge Function. Format routing table lit up. End state: 25MB ceiling lifted to 2GB; opus/ogg/flac/aac/webm-opus supported. **Requires DEEPGRAM_API_KEY procurement decision before this phase starts.**
5. **Realtime UX (MAN-05 friendly errors + broadcast invalidation)** — Postgres trigger, RLS policy on `realtime.messages`, `useTranscriptionRealtime` hook mounted in `Layout.tsx`. Optimistic placeholder rows. Retry button on failed jobs.
6. **Format parsers (MAN-02): SRT + Otter** — add `_shared/srt-parser.ts` using `npm:subtitle`, `_shared/otter-parser.ts`. Add `detectTranscriptFormat()` to `save-pasted-transcript`. Define canonical CallVault JSON shape, document in `docs/architecture/transcript-formats.md`.
7. **Behavioral integration tests (MAN-04)** — real-Supabase tests for `save-pasted-transcript` and the new async pipeline end-to-end. **MUST NOT mock Supabase** — the CONCERNS doc cites the Phase 30 / BUG-01 precedent where a mocked test passed the exact bug that broke prod.

**Cross-cutting dependencies:**

- The `ingest_transcript` MCP write tool (Workstream 4) calls into the same `runPipeline()` the worker uses. Workstream 3 must establish the worker + `runPipeline()` wiring before Workstream 4 can ship `ingest_transcript`'s composite metadata path cleanly.
- Realtime broadcast is keyed on `organization_id` today; if multi-workspace event filtering matters for UX (and per-workspace MCP work suggests it might), consider keying on `workspace_id` from the start.
- `recordings.share_url` is NOT a top-level column — the worker writing recording rows must use the source_metadata path; the UI must already use `resolveShareUrl()`. Don't regress.

---

## Workstream 4 — Multi-MCP per-Workspace + Refactor + AI Write Tools

**Recommended architecture:**
Path-based per-workspace endpoints of shape `https://mcp.callvaultai.com/w/{workspace_uuid}` (single host, path scoping — matches Notion, Linear, Cloudflare's own servers; explicitly not subdomain, explicitly not query parameter). The existing Cloudflare Worker already forwards `/mcp/*` correctly; the work is server-side path parsing. The 3,921-line monolith stays as **ONE Edge Function** (Supabase officially recommends "fat functions" to minimize cold starts) but is refactored internally into a `tools/registry.ts` pattern with one `{ definition, handler, category }` module per tool. Existing 19 write tools stay atomic. One new composite tool — `ingest_transcript` — accepts transcript + metadata + speakers + tags + notes + folder in a single call (justified by AI ergonomics: an agent that just transcribed audio has all metadata in one context window). Three additional atomic tools: `append_to_transcript`, `update_call_metadata`, `set_speakers`. Total: 36 → 40 tools. "Connect to AI" UX issues prefixed hex tokens (`cv_ws_<hex>` / `cv_org_<hex>`) with copy-paste JSON snippets for Claude Desktop, Cursor, and generic mcp-remote bridge.

**Key technical decisions:**

- **Path-based URLs, not subdomain, not query parameter.** Query parameter explicitly violates RFC 8707 (audience binding fails silently). Subdomain requires Cloudflare wildcard cert + DNS per workspace with zero offsetting benefit. Path is what every conformant production MCP server (Notion, Linear, Cloudflare's own) uses.
- **One Edge Function, registry-of-handlers inside.** Splitting into 36 Edge Functions multiplies cold-start tax linearly. Source-file maintainability is fixed with module structure, not function splitting. Supabase docs explicitly endorse this.
- **Dynamic-import AI deps inside AI tool handlers.** Currently `mcp-server/index.ts:2-3` top-level imports `ai` and `@openrouter/ai-sdk-provider` — every `list_calls` cold-start pays AI SDK parse cost. Move to `await import(...)` inside AI handlers only. **Single biggest cold-start win available.**
- **`mcp_tokens` schema already supports workspace scope. No migration needed.** `scope IN ('workspace', 'organization')` and `workspace_id UUID` already exist. Auth code path at `mcp-server/index.ts:1118+` already branches.
- **Token prefix change: `cv_ws_<hex>` / `cv_org_<hex>`.** Self-describing in logs, enables GitHub-style secret scanning, backward-compatible with one-line regex fallback.
- **One composite write tool (`ingest_transcript`), everything else atomic.** Workato/Anthropic guidance: one tool, one action, no hidden side effects. The composite is justified because forcing an agent to chain `create_recording` → `add_transcript` → `set_speakers` → `tag_call` → `move_to_workspace` burns 5 round-trips, 5 latency hops, 5 chances for partial-failure inconsistency. Names not IDs for fuzzy fields (tags, speakers). Returns markdown text via `content[].text` shape, NOT structured JSON (the spec requires this; CallVault has the fix recorded in runbook — don't regress).
- **`tools/list` MUST filter by `token.enabled_categories`** — information disclosure otherwise. SEP-1881 blesses this pattern as of Nov 2025.
- **Audience validation per workspace path** — when JWT/hex token presented to `/mcp/w/{id}`, server cross-checks token's workspace_id (for workspace-scoped) or token's org owns the workspace (for org-scoped). Mismatch returns 403, not 401 (token is valid, not for this resource). RFC 8707.
- **Slug-based URLs deferred.** UUID URLs are functionally correct; `workspaces.slug` is aesthetic polish, skip in v1.

**Suggested phase ordering inside Workstream 4:**

1. **Phase A: Extract types + helpers (mechanical, zero behavior change).** Create `tools/_types.ts`, `tools/_shared.ts`, `auth.ts`, `routing.ts`. Move existing helpers (`fetchOrgWorkspaceIds`, `unauthorizedResponse`, etc.) into new homes. `index.ts` body unchanged; only imports move. Safe to ship behind one PR-style commit. **Build runs against committed tree before push — `source-registry.ts` precedent applies.**
2. **Phase B: Extract one tool as the pattern.** Pick `search_calls` (highest-volume, exercises both scope branches, exercises org-boundary helper). Use the `ToolModule` contract. Update `index.ts` switch to call its handler. Interceptor verification mandatory.
3. **Phase C: Extract remaining 35 tools.** Batch by ~3-4 per commit. Build + RLS regression test after every batch.
4. **Phase D: Move dispatch to handler map.** Delete the giant switch; replace with `HANDLERS.get(toolName)`. Smallest commit, biggest leverage. **End of Phase D: monolith refactor (MCP-05) is complete.**
5. **Phase E: Per-workspace path routing (MCP-01).** `routing.ts.resolveWorkspaceFromPath()`. Auth path updated to read workspace from URL. PRM metadata updated to be per-workspace. Worker update is one new well-known route for per-workspace PRM. **Audience validation cross-check is non-negotiable — Section "Anti-Pattern 3: Confused deputy attack" must be defended.**
6. **Phase F: Token management UI (MCP-03) + "Connect to AI" UX (MCP-02).** Token prefix migration. Per-workspace mint flow. Three-tab modal (Claude Desktop / Cursor / mcp-remote). One-time display of token. GitHub-PAT-style list view with revoke + rotate.
7. **Phase G: New write tools (MCP-04).** `ingest_transcript`, `append_to_transcript`, `update_call_metadata`, `set_speakers`. **`ingest_transcript` should land AFTER Workstream 3's `runPipeline()` async wiring is live, OR it runs synchronously inside the MCP request and degrades the MCP UX.**
8. **Phase H: Cold-start optimization.** Dynamic-import AI deps in `tools/ai/*.ts`. Bench cold start before/after; expect significant drop on read-only paths.

**Cross-cutting dependencies:**

- **`ingest_transcript` ↔ Workstream 3's async pipeline.** If `ingest_transcript` writes synchronously (calling Whisper/Deepgram inside the MCP request), it inherits the same wall-clock failure mode the milestone is trying to fix. Recommended: `ingest_transcript` accepts the transcript text directly (the agent already has it) → calls `runPipeline()` directly → returns immediately. The async transcription pipeline is for raw audio file ingestion (file upload UX). The MCP write tool is for transcript-already-in-hand ingestion. Different paths, same `runPipeline()`. Surface the distinction explicitly to the roadmapper.
- **Workstream 2 (per-workspace connector binding, CON-04) may want to flow URLs through the per-workspace MCP endpoint to demonstrate the workspace boundary.** Not a hard blocker, but if marketing wants to ship a "your sales workspace, AI-connected" story, MCP-01 needs to land first.
- **HRD-01 (sync-tab from `recordings` not `fathom_calls`)** is orthogonal to both workstreams but bears on the same files (`sync-tab.service.ts`) — sequence so it doesn't collide with connector-reliability work.

---

## Workstreams 1 & 2 — Roadmapper Should Pull From Codebase Map

No targeted research; the codebase map is the binding constraint.

**Workstream 1 (Onboarding):**
- AppShell 4-pane pattern is the layout binding. Empty states live inside Pane 3 or as full-pane fallbacks; no drawer overlays (architectural constraint).
- Polar billing wiring is already complete (`src/hooks/useSubscription.ts`, `polar-checkout` Edge Function, webhook receiver). ONB-03 is paywall gates + upgrade dialog + post-upgrade state, NOT plumbing.
- First-run wizard exists; the work is polish + no-dead-ends + clean "you're done" state per PROJECT.md.

**Workstream 2 (Connector reliability):**
- All 7 connectors share `_shared/connector-pipeline.ts` and a consistent Edge Function pattern (`<source>-oauth-url`, `<source>-oauth-callback`, `<source>-oauth-refresh`, `<source>-fetch-meetings`, `<source>-sync-meetings`, `<source>-webhook`). Hardening work follows the same shape per source.
- `connectorRegistry.ts` + per-source adapters are the dispatch pattern. New unified connection-status UI (CON-02) reads through this same registry, not bypassing it.
- `source-registry.ts` `oauthCallbackFunctionName` entries are a known fragile surface — any refactor touching this file must run `npm run build` against the committed tree (not working tree) before push. Production has crashed on this once already (`9b6e3338`).
- Per-workspace connector binding (CON-04) likely touches `import_sources` schema; PROJECT.md notes binding is currently org-or-user-level depending on source.

---

## Cross-Workstream Sequencing Constraints

**Hard ordering (must be sequential):**

1. **Workstream 3 Phase 3 (worker + `runPipeline()` async wiring) BEFORE Workstream 4 Phase G (`ingest_transcript`).** Otherwise the new composite tool synchronously calls transcription and inherits the wall-clock problem the milestone is fixing. If `ingest_transcript` accepts already-transcribed text (recommended), this becomes soft — but `runPipeline()` should be stable before composite tool ships.
2. **Workstream 4 Phases A–D (monolith refactor) BEFORE Workstream 4 Phase E (per-workspace routing).** Adding workspace path routing into the monolith is possible but compounds the refactor surface area. Refactor first, then add the feature.
3. **HRD-01 (sync-tab → `recordings`) BEFORE final Workstream 2 hardening polish.** Non-Fathom recordings invisible in sync tab contradicts the "unified vault" promise; CON-02 (unified connection-status UI) will look incoherent if the sync tab itself is still Fathom-only.

**Soft ordering (preferred but not blocking):**

- **Workstream 4 Phase E (per-workspace endpoints) BEFORE Workstream 2 CON-04 (per-workspace connector binding)** — having the workspace-as-MCP-endpoint mental model already established makes the per-workspace connector UI more intuitive.
- **Workstream 3 Phase 1 (foundation) and Workstream 4 Phase A (mechanical extraction) can run in parallel** — both are pure substrate work that don't change behavior. Different files. Different agents could own each.
- **HRD-02 (RLS regression CROSS_ORG_TABLES gaps)** should land BEFORE public launch but is otherwise schedule-independent. Treat as a separate small phase late in the milestone.

**Parallelizable:**

- Workstream 1 (onboarding) is largely UI work in `src/components/onboarding/` and empty-state surfaces. Independent of 3 and 4.
- Workstream 3 format parsers (Phase 6) is independent of the async pipeline phases — can be done by a separate developer in parallel.

---

## Open Questions for Phase-Level Discussion

These should be resolved at phase planning, NOT at roadmap creation:

1. **Deepgram API key procurement + cost model.** Deepgram at $0.0218/min vs Whisper $0.006/min ≈ 3.6× cost for >25MB files. Who eats it? Pro-tier-only feature? Hard quota? Pricing question for Andrew.
2. **Storage retention policy for `uploads/*`.** Research suggests 7-day TTL after recording row written. Confirm with product — some users may want to re-process audio if transcription quality complaints arise.
3. **Slug vs UUID URL aesthetic decision.** UUIDs work; slugs are nicer. Deferred per research, but should be re-litigated when "Connect to AI" UX is being designed (the snippet is the user-visible artifact).
4. **Speaker diarization consistency across providers.** Whisper doesn't natively diarize (CallVault uses post-hoc extraction via regex). Deepgram diarizes natively. UX may differ; need to pick canonical shape.
5. **`ingest_transcript` composite scope discipline.** Research recommends excluding `bulk_ingest_transcripts` array variant — confirm we hold the line during phase planning if pressure surfaces from agent-batch use cases.
6. **Realtime channel keying — `organization_id` vs `workspace_id`.** Research uses `workspace:<orgId>` for now. If multi-workspace UX requires per-workspace event isolation, key on `workspace_id` from the start to avoid migration later.
7. **`uploads` bucket file_size_limit cap.** Research suggests 2GB. Confirm Supabase Pro plan allows; defaults to 50MB without an explicit override.
8. **Worker function invocation security.** Research uses `app.cron_secret` via `current_setting()` for pg_cron → worker auth. Confirm secret rotation pattern.

---

## Key Constraints to Preserve

Binding rules from PROJECT.md + codebase map. The roadmap MUST respect:

- **Tech stack locked.** React 18 + Vite 5 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react`. No Lucide, FontAwesome, framer-motion, pnpm/bun/yarn. npm only.
- **Backend: Supabase + Deno Edge Functions.** All AI/LLM/embedding in Edge Functions (constraint AI-02 bans frontend AI). All deploys via `supabase functions deploy --use-api` (Docker not available).
- **Service + Hook separation is the locked data-access pattern.** Services = pure async TS, no React. Hooks = TanStack Query wrappers. Components never call services directly.
- **`invalidateCallListCaches(queryClient)` in every mutation `onSettled`.** Partial invalidation = stale UI.
- **Recording IDs cross UUID/BIGINT boundary via `toRecordingUuid()` / `toRecordingUuidBatch()` only.** Never `parseInt()`, `Number()`, or string coercion. `src/lib/recording-ids.ts` is the boundary.
- **`recordings.share_url` is not a top-level column.** Always use `resolveShareUrl()` from `src/lib/recording-source-url.ts`. New code reading `.share_url` directly will silently fail for paste-import recordings.
- **`source-registry.ts` `oauthCallbackFunctionName` entries are critical boot-time artifacts.** Missing entries crash React mount. Run `npm run build` against the committed tree (not working tree) before every push during refactors.
- **Edge Function auth: `authenticateRequest(req, supabase, corsHeaders)` from `_shared/auth.ts`.** Never inline auth boilerplate.
- **MCP server CORS is intentionally wildcard.** RFC 9728/7591 require world-readable discovery. Auth enforced at bearer-token layer. Don't add session-cookie data to wildcard-CORS endpoints.
- **MCP tool result shape: `content[].text` markdown.** NOT structured JSON. Spec-strict clients reject otherwise. Runbook records this; refactor must not regress.
- **`tools/list` filtered by `token.enabled_categories`.** Information disclosure otherwise.
- **Direct-main workflow.** No feature branches, no PRs unless Andrew explicitly asks. Commit and push to `origin/main`.
- **`api.callvaultai.com` is the public-facing Worker endpoint.** Backend lives at Supabase; Worker forwards.
- **Brand: "AI-ready, not AI-powered".** Never positive "AI-powered" in UI copy.
- **One-Click Promise.** Every feature completes the user's job in the fewest possible actions, ideally one click.
- **Integration tests for new pipeline MUST NOT mock Supabase.** CONCERNS Phase 30 / BUG-01 precedent: mocked test passed the exact UUID/BIGINT bug that broke prod. Real-DB integration tests required for MAN-04.
- **`mcp_tokens` schema already supports workspace scope.** No migration needed for MCP-01 baseline.

---

## References

### Workstream 3 (Async transcription) — primary sources

**Supabase official:**
- [Background Tasks](https://supabase.com/docs/guides/functions/background-tasks)
- [PGMQ Extension](https://supabase.com/docs/guides/queues/pgmq)
- [Supabase Queues](https://supabase.com/docs/guides/queues)
- [Create signed upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Resumable Uploads (TUS)](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Realtime Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database)
- [Edge Function wall clock limit](https://supabase.com/docs/guides/troubleshooting/edge-function-wall-clock-time-limit-reached-Nk38bW)

**Transcription providers:**
- [OpenAI Audio API FAQ — 25MB limit, formats](https://help.openai.com/en/articles/7031512-audio-api-faq)
- [Deepgram Pre-Recorded Audio](https://developers.deepgram.com/docs/pre-recorded-audio)
- [Deepgram Callback mode](https://developers.deepgram.com/docs/using-callbacks-to-return-transcripts-to-your-server)

**Parsers:**
- [`subtitle` npm](https://www.npmjs.com/package/subtitle) — SRT + VTT
- [Otter SRT export docs](https://help.otter.ai/hc/en-us/articles/11742706003735-Create-captions-subtitles-for-your-video)

**Anti-pattern citation:**
- [ffmpeg.wasm Deno support (still open)](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/110)

### Workstream 4 (Multi-MCP) — primary sources

**MCP spec (2025-06-18):**
- [Authorization spec — Canonical Server URI](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#canonical-server-uri)
- [Tools spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [SEP-1881 Scope-Filtered Tool Discovery](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1881)

**Production MCP servers (URL patterns verified):**
- [Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp) — `mcp.notion.com/mcp`
- [Linear MCP](https://linear.app/docs/mcp) — `mcp.linear.app/mcp`
- [Cloudflare MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)

**Tool design authoritative:**
- [Workato MCP server tool design](https://docs.workato.com/en/mcp/mcp-server-tool-design.html)
- [Anthropic — Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)

**Supabase Edge Functions architecture:**
- [Functions routing — fat function guidance](https://supabase.com/docs/guides/functions/routing)
- [Edge Functions architecture (ESZip)](https://supabase.com/docs/guides/functions/architecture)

**Client configuration:**
- [MCP config files complete guide](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)

### Internal repo references

- `.planning/PROJECT.md` — all 4 workstreams + Key Decisions
- `.planning/codebase/ARCHITECTURE.md` — service+hook separation, 4-pane AppShell, query-key factory
- `.planning/codebase/INTEGRATIONS.md` — 7 connectors + Polar + MCP setup inventory
- `.planning/codebase/CONCERNS.md` — fragile surfaces, dual-ID system, mocked-test precedent
- `supabase/functions/mcp-server/index.ts` — current 3,921-line monolith (refactor target)
- `supabase/functions/mcp-server/index.ts:1080-1180` — auth + workspace scope branching (Phase E extension point)
- `supabase/functions/file-upload-transcribe/index.ts` — current synchronous pipeline (Workstream 3 replacement target)
- `supabase/migrations/20260310160000_mcp_tokens.sql` — schema already supports workspace scope
- `cloudflare/api-proxy/worker.ts:143-145` — Worker `/mcp/*` forward rule (already correct)
- `docs/operations/mcp-runbook.md` — canonical MCP URLs + `content[].text` outputSchema contract

---

*Synthesis complete. Ready to feed gsd-roadmapper.*
