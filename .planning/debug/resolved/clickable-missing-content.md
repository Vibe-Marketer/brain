---
status: resolved
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
- next_action: None for available source content. Recovery and prevention fixes verified; five provider-side summary gaps and one empty provider transcript remain documented below.

## Evidence
- Live read-only production SQL on 2026-09-10: Clickable Impact organization 3def74de-495f-411b-b5dd-b3852429b14d contains 249 calls, 196 with neither transcript nor summary.
- John (67605e64-8a57-4844-a72e-63cb90c84238) owns 211 organization calls: 188 empty transcripts, 199 empty summaries. All 211 are copies of his Personal originals, created July 28 13:35:07–13:36:29 UTC. None has missing content recoverable from its original in current storage.
- 183 John's organization calls have import_source=connector-sync-all; every one has empty transcript and summary. All 183 matched Personal originals are also empty.
- July 21 job 92ba0d35-a272-4e29-b858-00634ab94430 reported completed: 389 processed, 183 synced, 206 skipped, zero failed. July 28 copy metadata preserves copied_from_recording_id and copied_from_org_id.
- John's remaining five missing transcripts came from sync-meetings (three June 18, two July 21); original canonical AND raw records also have empty transcripts. One has a summary, four have neither. Exact provider-side cause of these five is not established.
- Twelve John's webhook imports had transcripts but lacked canonical summaries at diagnosis; the later recovery checked provider responses and existing metadata.
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
- Production recovery completed via scripts/repair-clickable-fathom.mjs using the existing owner OAuth connections. Each original/copy was snapshotted under BB_THREAD_STORAGE with restricted permissions; only missing content was filled. No recordings were created and titles/placement/ownership were preserved.
- All 200 affected John-owned calls were processed without errors, alongside Andrew's affected calls. In the organization, 196 transcripts and 216 summaries were restored, improving 221 recordings. Linked originals were repaired too. Final counts: John 211 calls, 210 transcripts, 206 summaries; Andrew 38 calls, all with transcripts and summaries. Total: 248/249 transcripts, 244/249 summaries.
- Live Fathom OAuth response reports RateLimit-Limit=10, with Retry-After. Recovery honors cooldown; further concurrency under the same token does not increase this quota. Sources with independent credentials were processed concurrently.
- Webhook secondary root cause: webhook parses default_summary and writes raw/metadata summary but omits top-level summary in runPipeline payload. Add top-level summary; 18 remaining canonical summaries (nine original/copy pairs) restored directly from existing provider metadata with no network requests.
- Live browser proof as a@vibeos.com: repaired Sales Huddle 03e2a2aa-e6ba-4fcf-befa-2c97c07b2a7c opens within Clickable Impact with source summary and full speaker transcript. Evidence: BB_THREAD_STORAGE/recovered-overview.png and recovered-transcript.png.
- Actual new hydrateFathomRecord helper run against live Fathom recording 161998394 returned 146609 transcript characters, 10703 summary characters and 1727 segments.
- Final preservation verification checked 460 baseline records, titles, organization/owner/provider IDs, source metadata and workspace entries, plus existing non-empty content and segments across recovery snapshots covering 437 distinct records: zero violations. Artifact: BB_THREAD_STORAGE/clickable-recovery-verification.json.
- Local segment repair completed: 430 original/copy rows filled with 178878 canonical speaker segments using existing transcript text, without provider requests. Five unrecognized texts were left untouched; existing text remains available in UI and get_transcript.
- Remaining source exceptions (HTTP 200 with empty content, not request failures): Alvaro Fernandez (provider 117529376), ENOUGH + John - DNS/SPF settings (112162028), Email Team Call (Updated) (131988471), Impromptu Google Meet Meeting (125765928), and Sales Huddle (119242564) have no provider summary. Sales Huddle also returned an empty transcript. No content was fabricated; repeating the same import cannot fill these current upstream gaps.

## Prevention and deployment verification
- Commit 899a708f pushed to origin/main: Fathom Sync All hydrates transcript/summary through recording endpoints, maps canonical speaker segments, and handles throttling with resumable cursors instead of losing progress or reporting metadata-only success. Existing local re-entry does not require a provider fetch. Webhook passes parsed summary into the canonical pipeline.
- Validation: 54 unit/adjacent tests and four real TEST database integration tests passed. Real database coverage includes hydration/duplicate handling, local re-entry, content throttling/resumption, and initial-list throttling. No Supabase mocks. Both changed Edge Functions passed Deno check; shared modules passed Deno lint.
- npm run build passed against the committed tracked tree (exit zero).
- connector-sync-all and webhook deployed to production vltmrnjsubfzrgrtdqey using Supabase API deployment. Live function POST probes reached handlers: nonexistent job returned 404 Job not found; unsigned webhook returned 401 Invalid signature. Production app returned HTTP 200.
- Structured content follow-up uses existing parseFathomCopyFormat and canonicalTurnsToSegments locally, filling only missing segments for incident snapshot IDs. Both parser/canonical test suites passed (38 tests). Five preview rows are intentionally skipped because their stored text is not recognized by the parser; text remains available through UI and get_transcript.

## Faster retrieval research
- https://developers.fathom.ai/api-reference/meetings/list-meetings — API-key list requests can include transcripts and summaries; unavailable for OAuth. Neither John's import_source nor legacy user_settings has an API key.
- https://developers.fathom.ai/api-reference/recordings/get-transcript — destination_url enables asynchronous delivery; no documented quota advantage.
- https://developers.fathom.ai/faq — no bulk endpoint or historical webhook replay. Best current path is durable cursor/resume, quota-aware concurrency, fetch each source once, and locally populate linked copies.
