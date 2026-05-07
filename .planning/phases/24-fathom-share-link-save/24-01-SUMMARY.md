---
phase: 24-fathom-share-link-save
plan: 01
subsystem: import
tags: [fathom, paste, transcript-parser, edge-function, supabase, react-modal, ugc, dedup]

# Dependency graph
requires:
  - phase: 09-bank-vault-architecture
    provides: recordings table + RLS, organization_id scoping
  - phase: 11-foundation
    provides: useOrgContext, organization_memberships pattern
  - phase: 12-import-flows-source-details
    provides: ImportPage layout, import-source dispatcher, ImportOverviewDashboard
provides:
  - User-paste path for saving Fathom share-link content (no server-side fathom.video fetches)
  - Pure-TS Fathom transcript parser shared between Deno edge runtime and Vite client
  - save-pasted-transcript edge function with org-scoped dedup
  - Vite @shared alias for importing pure-TS edge utilities into the React bundle
  - Recording detail rendering branch for source_app === 'fathom-paste'
affects: [25-workspace-type-retirement, fathom-bookmarklet-v2, otter-paste, zoom-paste, multi-source-paste]

# Tech tracking
tech-stack:
  added: [Vite @shared alias for cross-runtime shared utilities]
  patterns:
    - "Pure-TS shared modules (zero Deno/Node deps) imported by both edge and client"
    - "Explicit select-then-insert/update for deterministic upsert action labels"
    - "User-as-actor / UGC legal posture — zero outbound HTTP to source platforms"

key-files:
  created:
    - "supabase/migrations/20260507120000_recordings_paste_columns.sql — share_token + transcript_segments columns + partial unique index"
    - "supabase/functions/_shared/fathom-transcript-parser.ts — pure parser, dual-runtime importable"
    - "supabase/functions/save-pasted-transcript/index.ts — POST endpoint with JWT, Zod, org-membership check, dedup"
    - "src/components/import/PasteTranscriptModal.tsx — Radix Dialog with live parser preview"
  modified:
    - "src/pages/ImportPage.tsx — Save Transcript CTA on overview state"
    - "src/types/meetings.ts — widen source_platform union with 'fathom-paste'"
    - "src/components/call-detail/CallDetailHeader.tsx — VIEW button branches for paste source + adds noopener,noreferrer"
    - "src/components/call-detail/CallOverviewTab.tsx — 'From Fathom share link' source pill"
    - "src/hooks/useWorkspaces.ts — comment confirming permissive cast routes 'fathom-paste'"
    - "src/lib/source-labels.ts — fathom-paste → 'Fathom' mapping"
    - "src/components/transcript-library/TranscriptTableRow.tsx — Fathom icon for paste rows"
    - "src/components/transcript-library/SourcePlatformIcons.tsx — paste rows count as Fathom platform"
    - "vite.config.ts + tsconfig.json + tsconfig.app.json — @shared path alias"

key-decisions:
  - "Use organization_id (current schema) instead of bank_id (legacy plan term) — table renamed in 20260301000001"
  - "Populate source_call_id = share_token alongside the new share_token column so the existing global dedup constraint (organization_id, source_app, source_call_id) catches duplicates as defense-in-depth"
  - "Modal CTA placed as floating absolute-positioned button over the overview dashboard's PageHeader — keeps ImportOverviewDashboard.tsx untouched (out of scope per plan files_modified)"
  - "Paste-source recordings show the Fathom icon and 'Fathom' source label in the table — only the recording detail page differentiates paste vs API-import via the source pill"
  - "@shared alias added at vite + tsconfig level — only zero-dep pure-TS modules are safe to import this way"

patterns-established:
  - "Pure-TS @shared modules: any utility in supabase/functions/_shared/*.ts that uses zero runtime imports can be consumed by the React bundle via the @shared alias for client-server logic parity (e.g. parser preview matches what the server stores)"
  - "Explicit select-then-update/insert for deterministic upsert: when the action label matters (created vs updated), do the lookup yourself instead of relying on supabase.upsert + checking timestamps"
  - "User-as-actor legal posture: every server-side reference to fathom.video must be either a comment, an error message, or a placeholder string — never a fetch target. Verified by `git diff | grep fathom.video` review gate."

requirements-completed:
  - PASTE-01
  - PASTE-02
  - PASTE-03
  - PASTE-04

# Metrics
duration: ~70min
completed: 2026-05-07
---

# Phase 24 Plan 01: Fathom Share-Link Save Summary

**User-paste flow for permanently saving Fathom share-link transcripts as searchable recordings, with org-scoped dedup, structured segment parsing, and recording-detail rendering — zero server-side fathom.video fetches.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-05-07T03:55:00Z
- **Completed:** 2026-05-07T05:07:28Z
- **Tasks:** 4
- **Files created:** 6 (migration, parser, edge function, modal, deferred-items.md, this summary)
- **Files modified:** 9 (ImportPage, meetings.ts, useWorkspaces, CallDetailHeader, CallOverviewTab, source-labels, TranscriptTableRow, SourcePlatformIcons, vite.config + 2 tsconfigs)

## Accomplishments

- **Migration shipped:** `share_token TEXT` + `transcript_segments JSONB` columns added to `recordings`. Partial unique index on `(organization_id, share_token) WHERE share_token IS NOT NULL` enforces dedup. Migration file: `supabase/migrations/20260507120000_recordings_paste_columns.sql`.
- **Parser shipped:** `supabase/functions/_shared/fathom-transcript-parser.ts` — pure TypeScript, zero Deno/Node imports. Handles M:SS / MM:SS / H:MM:SS timestamps, multi-line speaker turns, CRLF line endings, optional headers (Title/Date/Attendees with multiple synonym keys), graceful raw-text fallback when format is unrecognized. 8 spot-check cases pass.
- **Edge function shipped:** `supabase/functions/save-pasted-transcript/index.ts` — POST endpoint with JWT auth, Zod validation (max 5MB, min 20 chars), `organization_memberships` membership gate, `^https?://(www\.)?fathom\.video/` regex on share_url for T-24-08 defense-in-depth, explicit select-then-insert/update for deterministic 'created' | 'updated' action labels. Deno typecheck passes.
- **UI shipped:** `PasteTranscriptModal.tsx` (Radix Dialog with URL field, monospace transcript textarea, live parser preview using `useMemo` + the same `@shared/fathom-transcript-parser` module the server uses). ImportPage gets a "Save Transcript" CTA on the overview state. Recording detail page renders the source pill + branches the VIEW button label.
- **Hard gate passes:** zero outbound HTTP to fathom.video — verified by `git diff | grep`. Only matches are placeholder text, error messages, and comments. No `fetch(...)`, no `axios`, nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration + parser util** — `60d2b0ff` (feat)
2. **Task 2: save-pasted-transcript edge function** — `278e21c4` (feat)
3. **Task 3: PasteTranscriptModal + ImportPage CTA** — `1bf3dd63` (feat)
4. **Task 4: Recording detail rendering** — `5aaaa813` (feat)

_Final docs commit will land alongside this SUMMARY.md._

## Files Created/Modified

### Created

- `supabase/migrations/20260507120000_recordings_paste_columns.sql` — `ALTER TABLE recordings ADD COLUMN share_token TEXT, transcript_segments JSONB`. Adds partial unique index `idx_recordings_org_share_token ON recordings(organization_id, share_token) WHERE share_token IS NOT NULL`. Comments on both columns reference the phase.
- `supabase/functions/_shared/fathom-transcript-parser.ts` — `parseFathomCopyFormat`, `extractShareToken`, `FathomParsedTranscript`, `FathomSegment`. Pure TS, no runtime imports. Detection rule: 2+ matching speaker-turn lines required; otherwise returns `parse_status: 'raw'`. Multi-line turns concatenate until the next speaker line. Attendees = union of header attendees + distinct speaker names, deduplicated case-insensitively.
- `supabase/functions/save-pasted-transcript/index.ts` — POST endpoint at `/functions/v1/save-pasted-transcript`. CORS preflight, JWT auth via `supabase.auth.getUser()`, Zod input validation, `organization_memberships` membership lookup with 403 on miss, parser invocation, explicit select-on-`(organization_id, share_token)` for dedup branch, plain insert when no token. Returns `{ success: true, data: { recording_id, action } }`.
- `src/components/import/PasteTranscriptModal.tsx` — Radix Dialog. Contains: optional URL `Input` with `RiLinkM` prefix, transcript `Textarea` (monospace, min 240px), live preview block (parser memoized over textarea value) showing detected `n turns · m speakers`, editable title `Input`, editable `datetime-local` date `Input`, comma-separated attendees `Input`. Save button disabled until transcript ≥ 20 chars + active org. Handler calls `supabase.functions.invoke('save-pasted-transcript')`, invalidates `queryKeys.calls.all` + `['workspace-entries']`, navigates to `/?callId=<id>`.
- `.planning/phases/24-fathom-share-link-save/deferred-items.md` — pre-existing test/lint failures verified to be on `main` before this plan's commits.
- `.planning/phases/24-fathom-share-link-save/24-01-SUMMARY.md` — this file.

### Modified

- `src/pages/ImportPage.tsx` — Adds `pasteModalOpen` state, `useOrgContext().activeOrgId`, `RiClipboardLine` import, floating Save Transcript button absolute-positioned over the overview's PageHeader, `<PasteTranscriptModal>` mounted at the page root.
- `src/types/meetings.ts` — Widens `Meeting.source_platform` union to include `'fathom-paste'`.
- `src/hooks/useWorkspaces.ts` — Inline comment on `mapRecordingToMeeting` line 382 confirming the permissive `as Meeting['source_platform']` cast already routes `'fathom-paste'` correctly. No code change.
- `src/components/call-detail/CallDetailHeader.tsx` — VIEW button: `RiLinkM` import, branches between "VIEW ON FATHOM" (paste) and "VIEW" (other), adds `noopener,noreferrer` to `window.open`.
- `src/components/call-detail/CallOverviewTab.tsx` — "From Fathom share link" pill (`RiLinkM` icon, `bg-muted/60` styling) rendered in the SHARE LINK column when `source_platform === 'fathom-paste'`.
- `src/lib/source-labels.ts` — `'fathom-paste'` → `'Fathom'` mapping (auto-fix to prevent literal-string display in the table).
- `src/components/transcript-library/TranscriptTableRow.tsx` — Fathom icon condition widened to `'fathom' || 'fathom-paste'`.
- `src/components/transcript-library/SourcePlatformIcons.tsx` — Same widening at lines 151 + 160.
- `vite.config.ts` — adds `@shared` alias → `./supabase/functions/_shared`.
- `tsconfig.json` + `tsconfig.app.json` — same `@shared/*` path mapping for IDE + tsc resolution.

## Decisions Made

- **Use `organization_id` instead of `bank_id`.** The plan referred to `bank_id` but the actual recordings column was renamed `bank_id → organization_id` in `20260301000001_rename_vaults_to_workspaces.sql`. All migration, edge function, modal, and dedup logic uses the correct column name.
- **Populate both `share_token` AND `source_call_id`.** The existing `recordings_source_dedup` global unique constraint is `(organization_id, source_app, source_call_id)`. Setting `source_call_id = share_token` for paste recordings means duplicates would also collide on the existing constraint as defense-in-depth — even if the new partial unique index were ever dropped, the older constraint still catches dupes.
- **Modal CTA via absolute positioning over PageHeader, not a new prop.** The plan listed only `ImportPage.tsx` + `PasteTranscriptModal.tsx` in `files_modified` for Task 3. Modifying `ImportOverviewDashboard.tsx` would have been out of scope, so the CTA is rendered as `position: absolute; right-4 top-3` on a wrapper around `<ImportOverviewDashboard>` only when no specific source is selected.
- **`@shared` alias for cross-runtime parser.** Adding the alias at both Vite and tsconfig levels lets `PasteTranscriptModal` use the exact same parser module as the edge function, guaranteeing the live preview matches the server's parsed output. Documented inline in `vite.config.ts` that only zero-dep pure-TS modules are safe to import this way.
- **Paste-source recordings appear as "Fathom" in the table.** The source IS Fathom — the only thing that's different is the path into CallVault was paste-by-user instead of API-imported. The recording detail page surfaces the distinction via the dedicated "From Fathom share link" pill.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan used `bank_id` but actual column is `organization_id`**
- **Found during:** Task 1 (when reading the recordings table schema)
- **Issue:** The plan and CONTEXT.md referenced `bank_id` throughout, but `20260301000001_rename_vaults_to_workspaces.sql` had renamed it to `organization_id`. The migration would have failed and the edge function upsert would have errored at runtime.
- **Fix:** All `bank_id` references converted to `organization_id` in the migration, the edge function payload, the Zod schema, and the modal prop name (`organizationId`).
- **Files modified:** `supabase/migrations/20260507120000_recordings_paste_columns.sql`, `supabase/functions/save-pasted-transcript/index.ts`, `src/components/import/PasteTranscriptModal.tsx`, `src/pages/ImportPage.tsx`.
- **Verification:** Confirmed `recordings.organization_id` exists by reading `connector-pipeline.ts:200`. Migration loads against schema. Deno typecheck clean.
- **Committed in:** `60d2b0ff` (Task 1), `278e21c4` (Task 2), `1bf3dd63` (Task 3).

**2. [Rule 1 - Bug] `getSourceLabel('fathom-paste')` returned the literal string**
- **Found during:** Task 4 (after widening the `source_platform` union)
- **Issue:** `src/lib/source-labels.ts` had no entry for `'fathom-paste'`, so the transcript table would have shown the raw literal string "fathom-paste" instead of a clean label.
- **Fix:** Added `'fathom-paste': 'Fathom'` to `SOURCE_LABELS`.
- **Files modified:** `src/lib/source-labels.ts`.
- **Verification:** TypeScript clean; visual confirmation deferred to dev-browser test (see Verification Gaps below).
- **Committed in:** `5aaaa813` (Task 4).

**3. [Rule 1 - Bug] TranscriptTableRow + SourcePlatformIcons strict equality with `'fathom'`**
- **Found during:** Task 4 (grep for `source_platform === 'fathom'`)
- **Issue:** `TranscriptTableRow.tsx:245` and `SourcePlatformIcons.tsx:151,160` compared strictly against `'fathom'` for icon rendering. Paste-source recordings would have shown no icon and would have been excluded from `SourcePlatformIcons` platform aggregation.
- **Fix:** Widened the comparison to `'fathom' || 'fathom-paste'` in all three spots, with a comment explaining why.
- **Files modified:** `src/components/transcript-library/TranscriptTableRow.tsx`, `src/components/transcript-library/SourcePlatformIcons.tsx`.
- **Verification:** TypeScript clean.
- **Committed in:** `5aaaa813` (Task 4).

**4. [Rule 2 - Security] `window.open` in CallDetailHeader missing `noopener,noreferrer`**
- **Found during:** Task 4 (when modifying the VIEW button)
- **Issue:** The original `window.open(call.share_url, "_blank")` did NOT include `noopener,noreferrer`. T-24-08's threat-model mitigation calls for it explicitly. Without it, the opened tab can `window.opener.location = "phishing"` back at the parent.
- **Fix:** Changed to `window.open(call.share_url, "_blank", "noopener,noreferrer")`.
- **Files modified:** `src/components/call-detail/CallDetailHeader.tsx`.
- **Verification:** Static — flag is now part of the `window.open` call signature.
- **Committed in:** `5aaaa813` (Task 4).

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 security mitigation alignment)
**Impact on plan:** All four were correctness/security requirements — none expanded scope. Deviation #1 was a plan↔schema drift the plan author didn't catch; it would have crashed at runtime if shipped as-spec.

## Issues Encountered

- **Pre-existing test failures.** 27 tests fail on `main` before this plan's commits (sidebar-nav: 17, tags.service: 5, useSharing: 4, useBulkApplyRules: 1). Verified by stashing the plan's changes and re-running vitest. Logged to `deferred-items.md`. Out of scope per executor rules.
- **Pre-existing TypeScript errors.** Many `.test.tsx` files reference `toHaveAttribute` / `toBeInTheDocument` matchers without the proper `@testing-library/jest-dom` types config. Phase 24 introduced ZERO new TS errors — verified by `npx tsc --noEmit` filtered to Phase-24 file paths.

## Verification Gaps (NOT silently skipped — explicit gaps for orchestrator)

The plan's `<verification>` section requires these actions; some required production access I deliberately avoided per CLAUDE.md global rules ("Before deleting, overwriting, uninstalling, or replacing existing user work [...] say in one line what you're about to destroy, and wait for a yes"). Logging here so the orchestrator/user can decide:

1. **Migration applied to hosted DB** — NOT done. The Supabase project is linked to `vltmrnjsubfzrgrtdqey` (production: `callvault-ai`). Running `supabase db push` would alter the production schema. **Action required from user:** review the migration and run `supabase db push` (or apply via the project's standard migration workflow). The migration is idempotent (`IF NOT EXISTS` on all DDL).

2. **Edge function deployed to hosted Supabase** — NOT done, same reason as above. **Action required from user:** `supabase functions deploy save-pasted-transcript --use-api`. Deno typecheck passes locally so the upload should succeed.

3. **Dev-browser end-to-end test** — NOT performed. The executor agent context does not have the dev-browser MCP / ghost OS tools available (system reminder lists them but the tool harness in this session is restricted to Read/Write/Edit/Bash). Dev server starts cleanly on port 3001 and serves the modal + parser via `/@fs/...` (verified by curl). **Action required from orchestrator:** spawn a verifier with dev-browser access OR have the user manually run through the flow:
   1. `npm run dev` → log in via `.env.local` test creds
   2. Navigate to `/import`
   3. Click "Save Transcript" → modal opens
   4. Paste this sample:
      ```
      Title: Q3 Sales Sync
      Date: October 5, 2026
      Alice Chen (0:00) Hey team, let's get started.
      Bob Smith (0:14) Thanks, ready when you are.
      Alice Chen (1:32) The numbers from last quarter are strong.
      ```
   5. URL field: `https://fathom.video/share/test-token-001`
   6. Click Save → toast → URL becomes `/?callId=...` → header shows "VIEW ON FATHOM" with `RiLinkM` icon → overview tab shows "From Fathom share link" pill
   7. Re-paste same URL+text → confirm same recording_id (no duplicate row)
   8. Search for "numbers from last quarter" in Cmd+K → confirm match

4. **Search integration verification (D-17)** — Indirectly verified: the existing `idx_recordings_transcript_fts` GIN index covers the new `full_transcript` column with no schema change, so paste-source rows are searchable for free. The end-to-end search test is part of #3 above.

5. **Dedup integration verification (D-03)** — Indirectly verified: the partial unique index + the explicit select-then-update/insert in the edge function deterministically returns `action: 'updated'` on second-paste. Sample SQL for confirming dedup post-deploy:
   ```sql
   SELECT id, title, source_app, share_token, organization_id, created_at, updated_at
   FROM recordings
   WHERE source_app = 'fathom-paste'
   ORDER BY created_at DESC
   LIMIT 5;

   -- After two pastes of the same URL, this should return exactly 1 row:
   SELECT count(*) FROM recordings
   WHERE organization_id = '<org-uuid>' AND share_token = 'test-token-001';
   ```

## Threat Flags

None — the plan's threat model already covers all surface introduced by this plan. Specifically:

- T-24-01 (auth) — JWT verified via `supabase.auth.getUser`
- T-24-02 (org tampering) — `organization_memberships` gate verified before write
- T-24-04 (info disclosure) — error responses use generic strings; full details only `console.error`'d
- T-24-05 (DoS) — Zod max-length 5MB on `raw_transcript`
- T-24-07 (XSS) — transcript text rendered via React (default escaping); no `dangerouslySetInnerHTML` in this diff
- T-24-08 (open redirect) — share_url validated against `^https?://(www\.)?fathom\.video/` regex AND `window.open` now uses `noopener,noreferrer`
- T-24-09 (legal/automated access) — verified by `git diff | grep`. Only fathom.video occurrences are placeholder text, error messages, and SQL comments. Zero `fetch()` / `axios` / outbound HTTP.

## Self-Check

Verifying claimed artifacts exist and commits are present.

```
$ ls -la supabase/migrations/20260507120000_recordings_paste_columns.sql
$ ls -la supabase/functions/_shared/fathom-transcript-parser.ts
$ ls -la supabase/functions/save-pasted-transcript/index.ts
$ ls -la src/components/import/PasteTranscriptModal.tsx
```

(Verified — all 4 files present, see commit hashes above.)

```
$ git log --oneline | head -4
5aaaa813 feat(24-01): paste-source recording detail rendering
1bf3dd63 feat(24-01): paste transcript modal + import page CTA
278e21c4 feat(24-01): save-pasted-transcript edge function
60d2b0ff feat(24-01): add paste-source recordings migration + Fathom transcript parser
```

(Verified — 4 task commits + plan-base commit `3a274ed4`.)

## Self-Check: PASSED

All claimed files exist on disk. All claimed commits exist in git history. All four PASTE-* requirements have implementation paths in the diff (edge function for PASTE-01/02/03, recording detail rendering for PASTE-04). Hard gate (zero outbound HTTP to fathom.video) passes. TypeScript clean (Phase 24 files). Deno typecheck clean. Lint clean (Phase 24 files). 8/8 parser spot-check cases pass.

## Next Phase Readiness

- **Bookmarklet (deferred):** This plan's edge function is the target endpoint a future bookmarklet would call. Same `save-pasted-transcript` POST contract. The user-as-actor legal posture is established.
- **Multi-source paste (deferred):** The parser is per-format. Future work could add `parseOtterCopyFormat`, `parseZoomCopyFormat`, etc., to `_shared/` and dispatch on detected format inside `save-pasted-transcript`. The dedup constraint (`organization_id, source_app, source_call_id`) generalizes naturally — each format gets its own `source_app` value.
- **Per-segment embeddings (deferred):** `transcript_segments` JSONB stores `{start_ms, speaker, text}` already. A future migration could add a `transcript_chunks` child table with pgvector for timestamp-anchored semantic search without changing the paste flow.

---
*Phase: 24-fathom-share-link-save*
*Plan: 01*
*Completed: 2026-05-07*
