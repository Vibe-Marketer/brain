# CODEX CLEANUP BRIEF — 2026-06-11

Target spec for a codex agent working in `/Users/admin/dev/brain` (CallVault — React 18 + Vite SPA in `src/`, Supabase Edge Functions in `supabase/functions/`, npm only). Three independent lanes, do them in order, one commit-group per lane. This file is untracked — do not commit it.

## Ground rules (non-negotiable)

- **Off-limits files (other agents actively own them):** `src/pages/admin/**`, `src/components/admin/**`, `src/App.tsx`, `src/components/ui/sidebar-nav.tsx`, `src/components/settings/AdminTab.tsx`, `src/components/settings/Ticket*`, `src/components/settings/NewTicketDialog.tsx`, `src/components/support/**`, `src/services/support-ticket.service.ts`, `src/services/tickets.service.ts`, `src/hooks/useTickets.ts`, `supabase/functions/send-support-ticket/**`, everything under `.planning/`. If a lane seems to need one of these, STOP that lane and note it.
- **Gates before every push:** `npm test` (full suite, ~1700 tests, must be 0 failures) and `npm run build` (exit 0). NOTE: `npm run type-check` is HOLLOW (checks zero files — known defect); use `npx tsc -p tsconfig.app.json --noEmit` and only judge errors in files you touched (~750 pre-existing legacy errors are not yours).
- **Commits:** conventional format, one logical change per commit, reference the ticket id in the message where given. Push directly to `main` (single-operator repo norm).
- **Brand/code rules:** Remix icons only, no new dependencies, service+hook separation, no AI code in frontend.
- **Verify before deleting:** every deletion below was probe-verified by a prior audit, but code moved since — re-run the importer grep yourself immediately before each delete. If a probe disagrees with this brief, trust the probe and skip that item with a note.

## Lane 1 — Dead-code purge (~1,900 LOC, ticket batch from Forge audit)

Commit prefix: `chore(dead-code):`

1. `supabase/functions/_shared/deduplication.ts` (501 LOC). Verify: `grep -rl "from.*deduplication" supabase/functions --include="*.ts" | grep -v _shared/deduplication` → must be empty. The live path is `dedup-fingerprint.ts` — untouched.
2. `src/pages/SharedWithMe.tsx` + `src/pages/SortingTagging.tsx` (789 LOC). Verify: no route element in App.tsx references them (only a removal comment at ~line 36) and no other importers. Do NOT edit App.tsx itself — it's off-limits; deletion is safe only if nothing imports them (verify!). If App.tsx still imports either file, SKIP this item and note it.
3. YouTube dead cluster: `src/components/youtube/YouTubeVideoDetailModal.tsx`, `YouTubeVideoList.tsx`, `YouTubeVideoRow.tsx`, and `src/hooks/useYouTubeSearch.ts`. Verify per file: zero importers outside the cluster itself and its tests. KEEP `YouTubeImportForm.tsx` (live — imported by ImportPage). Check `YouTubeVideoStats` / `YouTubeOutlierBadge`: delete only if their sole importers were the deleted cluster.
4. `src/components/import/FileUploadDropzone.tsx` + its test reference in `src/pages/__tests__/ImportPage.connector-routing.test.ts` (update the test, don't break it). KEEP the `file-upload-transcribe` Edge Function — dormant by design for v2.
5. `.env.example` lines ~163-169: remove the legacy `STRIPE_*` block. Verify: `grep -r "STRIPE_" src supabase` → 0 hits.

Acceptance: full suite green, build green, `git grep` finds no references to any deleted symbol.

## Lane 2 — `uiVisible` single source of truth (ticket f569570a, HIGH)

Commit prefix: `fix(f569570a):`

Problem: `uiVisible` is defined in `src/config/source-registry.ts` (lines ~92/192/234/257 — THE copy the UI reads via the `VISIBLE_*` filter chain consumed by `SourceFilterCheckboxes.tsx` and `SetupWizard.tsx`) AND duplicated at `src/components/connectors/registry/adapters/grain.ts:36` (read by nothing). A connector hidden in one can be visible in the other.

Fix: source-registry is canonical. Remove the `uiVisible` field from the adapter (and from the adapter's type if it's declared on ConnectorMetadata — check `src/components/connectors/registry/` types). Add a unit test asserting the adapter metadata type does NOT carry `uiVisible` (compile-time or runtime guard) so the split can't silently return. Confirm grain's intended visibility (it was `uiVisible: false` in the adapter — check what source-registry says for grain and make source-registry reflect the INTENDED state; if they disagree, grain's entry in source-registry is the one to set, with a comment).

Acceptance: one definition site remains; `rg "uiVisible" src/` hits only source-registry + its consumers + the guard test; suite + build green.

## Lane 3 — Unbounded `.in()` sweep, hot spots only (ticket 092deb91)

Commit prefix: `fix(092deb91):`

Problem class: `.in("id", <unbounded array>)` exceeds URL limits at scale → HTTP 400 (already bit us in prod: /people contact history). A shared helper now exists: `src/lib/chunk.ts` (`chunkArray`, `IN_FILTER_CHUNK_SIZE = 100`) with the reference fix pattern in `src/hooks/useContacts.ts` (`fetchContactCallRecordings` — chunk → `Promise.all` → merge in chunk order, per-chunk errors throw).

Sweep these hot spots ONLY (rest is a later batch): `src/components/transcripts/TranscriptsTab.tsx` (sites ~647, 687, 725, 742, 840, 874, 920, 948, 960, 982, 1016-1056 — note lines have drifted; find every `.in(` with a caller-derived array) and `src/hooks/useGlobalSearch.ts` (~240, 303, 364, 410). Apply the chunk pattern; preserve result ordering and shapes exactly. NOTE: TranscriptsTab already has 2-3 inline-batched sites at chunk size 200 — leave those or normalize them to the helper, your call, but behavior identical.

Add one regression test per FILE (not per site) proving >100 ids produce multiple chunked calls (mock the supabase client; mirror `src/hooks/__tests__/useContacts.callHistoryBatching.test.ts`).

Acceptance: zero unbounded `.in(` with caller-derived arrays remain in the two files; suite + build green.

## Reporting back

Finish each lane with a one-paragraph summary in the final commit message body (what deleted/changed, what skipped and why). The orchestrator's agents read git history — no other handoff needed. If anything looks wrong mid-lane (test failures you didn't cause, files moved), stop the lane and leave the summary; don't force it.
