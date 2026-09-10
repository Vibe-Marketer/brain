---
status: fixing
trigger: 'Clickable Impact calls visible to a@vibeos.com, originally added by john@clickableimpact.com, show links but no summary or transcript. Investigate what happened and whether resync is needed.'
created: 2026-09-10
updated: 2026-09-10
---

## Symptoms
- expected: Imported calls contain available source summary and transcript.
- actual: Many calls in Clickable Impact show a link without content.
- errors: None reported.
- timeline: Unknown; inspecting import timestamps.
- reproduction: Open affected organization under a@vibeos.com and inspect John's calls.

## Current Focus
- hypothesis: Confirmed metadata-only Sync All import, subsequently copied into organization.
- next_action: Complete owner-credential recovery, verify preserved content/placement, and ship tested Sync All hydration plus webhook summary fixes.

## Evidence
- Live read-only production SQL on 2026-09-10: Clickable Impact organization 3def74de-495f-411b-b5dd-b3852429b14d contains 249 calls, 196 with neither transcript nor summary.
- John (67605e64-8a57-4844-a72e-63cb90c84238) owns 211 organization calls: 188 empty transcripts, 199 empty summaries. All 211 are copies of his Personal originals, created July 28 13:35:07–13:36:29 UTC. None has missing content recoverable from its original in current storage.
- 183 John's organization calls have import_source=connector-sync-all; every one has empty transcript and summary. All 183 matched Personal originals are also empty.
- July 21 job 92ba0d35-a272-4e29-b858-00634ab94430 reported completed: 389 processed, 183 synced, 206 skipped, zero failed. July 28 copy metadata preserves copied_from_recording_id and copied_from_org_id.
- John's remaining five missing transcripts came from sync-meetings (three June 18, two July 21); original canonical AND raw records also have empty transcripts. One has a summary, four have neither. Exact provider-side cause of these five is not established.
- Twelve John's webhook imports have transcripts but lack summaries. Source-side summary availability not verified.
- Nine Andrew-owned connector-sync-all organization calls also have neither content field.
- Code: _shared/fathom-client.ts:87 listPage requests meetings without content hydration; connector-sync-all/index.ts:241-242 reads string transcript/full_transcript and summary, ignoring Fathom transcript arrays and default_summary.markdown_formatted. Metadata-only rows enter runPipeline and count as synced.
- Debugger executed current mapping in memory with metadata-only and transcript-array/default_summary input: both returned empty transcript and null summary.
- Code: connector-pipeline duplicate branch returns skipped before updates. Repeating Sync All does not hydrate existing originals.
- Code: fathom-refresh/index.ts:510 rejects non-owner (Andrew) access; :525-529 candidate IDs omit metadata.recording_id/external_id used by copies. All 211 John's copies lack fathom_provider_id, and copy procedure cleared source_call_id on the historical rows. Refresh updates only requested recording, not linked copies.
- Both accounts have organization membership: Andrew owner, John member. Missing fields are confirmed in direct DB reads, independent of RLS/UI.

## Eliminated
- Account visibility alone: fields are empty in privileged read-only SQL, not merely hidden from Andrew.
- Copy operation deleted content: all 211 copies have the same missing-content situation as their Personal originals.
- Routine Sync All as repair: duplicate handling skips existing originals; mapping still lacks Fathom content hydration.

## Resolution
- User explicitly authorized production repair and triggering from our end on 2026-09-10.
- Production recovery is running via scripts/repair-clickable-fathom.mjs. It uses the existing owner OAuth connection, fetches missing fields, snapshots each original/copy before update under BB_THREAD_STORAGE with restricted permissions, fills only empty content, and does not create recordings or alter titles/placement/ownership.
- All 38 Andrew-owned organization calls now have transcripts and summaries. John's 200 affected calls are being repaired (211 total); remaining incomplete fields are checked against actual provider availability.
- Live Fathom OAuth response reports RateLimit-Limit=10, with Retry-After. Recovery honors cooldown; further concurrency under the same token does not increase this quota. Sources with independent credentials were processed concurrently.
- Webhook secondary root cause: webhook parses default_summary and writes raw/metadata summary but omits top-level summary in runPipeline payload. Add top-level summary; 18 remaining canonical summaries (nine original/copy pairs) restored directly from existing provider metadata with no network requests.
- Live browser proof as a@vibeos.com: repaired Sales Huddle 03e2a2aa-e6ba-4fcf-befa-2c97c07b2a7c opens within Clickable Impact with source summary and full speaker transcript. Evidence: BB_THREAD_STORAGE/recovered-overview.png and recovered-transcript.png.
- Actual new hydrateFathomRecord helper run against live Fathom recording 161998394 returned 146609 transcript characters, 10703 summary characters and 1727 segments.
- Interim preservation verification checked 460 baseline records, titles, organization/owner/provider IDs, source metadata and workspace entries, plus existing non-empty content in recovery snapshots: zero violations.
- Repair must fetch available transcript/summary using John's source, update originals and linked Clickable copies without duplicate creation, and preserve organization/workspace placement and edited content. Fix Sync All hydration so new jobs cannot report metadata-only imports as fully synced.
- Full recovery remains in progress; do not mark resolved until final counts, preserved data, deployment and provider exceptions are recorded.

## Faster retrieval research
- https://developers.fathom.ai/api-reference/meetings/list-meetings — API-key list requests can include transcripts and summaries; unavailable for OAuth. Neither John's import_source nor legacy user_settings has an API key.
- https://developers.fathom.ai/api-reference/recordings/get-transcript — destination_url enables asynchronous delivery; no documented quota advantage.
- https://developers.fathom.ai/faq — no bulk endpoint or historical webhook replay. Best current path is durable cursor/resume, quota-aware concurrency, fetch each source once, and locally populate linked copies.
