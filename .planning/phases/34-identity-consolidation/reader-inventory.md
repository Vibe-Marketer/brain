# Phase 34 Reader Inventory — speakers / contacts / call_participants / call_speakers

**Purpose:** Enumerate and classify every read/write call site of `speakers`, `contacts`, `call_participants`, and the legacy `call_speakers` join, across `src/`, `supabase/functions/`, and `supabase/migrations/`. This is the mandatory precondition for IDENT-01's "existing readers unchanged" guarantee — a new nullable `identity_id` column is being added to `speakers`, `contacts`, and `call_participants` (NOT `call_speakers`, which is a legacy join table pointing at `speakers` and is documented here for context only).

**Method:** `grep -rn` sweep (single- and double-quote `.from()` variants, backtick variant checked and absent) across `src` and `supabase`, cross-referenced against `supabase/migrations/*.sql` for SQL-level `FROM`/`JOIN` readers (RPCs, triggers, RLS helpers). Every call site below was read in context to determine its actual `.select()` shape, not inferred from the `.from()` line alone.

**Date:** 2026-09-05 (Phase 34, Plan 01, Task 1)

## Legend

- **EXPLICIT-COLUMNS** — the query names specific columns (or the SQL function has an explicit `RETURNS TABLE(...)` / aggregate projection). A new nullable `identity_id` column is structurally invisible to this reader — it will never appear in the returned shape unless the reader is edited to ask for it.
- **BARE-SELECT-STAR** — the query calls `.select('*')` (or SQL `SELECT *` / `SELECT table.*`). A new nullable `identity_id` WILL appear in the returned row shape.
- **BARE-SELECT-NOARGS** — the query calls `.select()` with no arguments after an `.insert()`/`.upsert()` (supabase-js treats this the same as `select('*')` — returns every column of the affected row(s)).
- **N/A (write-only)** — `.insert()` / `.update()` / `.delete()` / `.upsert()` with no `.select()` chained at all. No row data is returned to the caller, so there is no column shape to break.
- **AGGREGATE/EXISTS** — `COUNT(*)`, `EXISTS(SELECT 1 ...)`, or `head: true` count-only queries. No individual column is ever projected, so a new column cannot appear in the result regardless of `*` usage in the query text.
- **Risk: SAFE** — an added nullable `identity_id` column cannot change this reader's behavior.
- **Risk: REQUIRES-ATTENTION** — an added nullable `identity_id` column WILL appear in this reader's returned data; the consuming code/type must tolerate an extra `identity_id: string | null` field (or Plan 02's noop test must explicitly exercise this call site).

**Zero exceptions found where a bare/star reader's consumer actually breaks from an added nullable column** — every `REQUIRES-ATTENTION` row below is either (a) a real production reader whose TypeScript consumer should be checked/tolerant, or (b) a test-only isolation check that doesn't access individual fields. Both categories are still flagged per the letter of the acceptance criteria so Plan 02's noop test can decide what to cover.

## Naming facts (recorded per plan instruction)

- **`contacts.org_id`** (NOT `organization_id`) — added by `20260310150000_contacts_org_scoping.sql`, backfilled from the user's personal org.
- **`call_participants.organization_id`** (full name, NOT `org_id`) — present since the original `20260309120000_call_participants.sql`.
- **`call_participants.participant_type`** (`attendee` | `speaker` | `host`) — the ORIGINAL sourcing classification, present since `20260309120000_call_participants.sql`.
- **`call_participants.role`** (`organizer` | `invitee` | `attendee` | `speaker`) — a SEPARATE column added five months later by Phase 30's `20260831000001_create_events_and_extend_participants.sql` (event-model classification, used by `has_confirmed_speech`/alibi logic). `participant_type` and `role` are NEVER interchangeable — only `supabase/functions/mcp-server/tools/read/get_recording_context.ts:73` currently selects `role` explicitly; every other reader below selects `participant_type`.
- **`speakers`** has no org/workspace scoping at all — it is `user_id`-scoped only (`UNIQUE(user_id, email)`), the oldest and simplest of the three tables.
- No existing column on any of the three tables stores a "provider participant id" (e.g., a Zoom/Fathom participant UUID) — see "Match sites for the resolver" below. `call_participants.sources` is a `TEXT[]` of *source names* (`'mcp_manual'`, `'transcript'`, `'zoom_webhook'`, etc.), not a provider identifier.

## Table 1 — Frontend (`src/`) call sites

| # | File:Line | Table | Select Style | Risk | Note |
|---|-----------|-------|--------------|------|------|
| 1 | `src/hooks/useGlobalSearch.ts:393` (`fetchParticipants`) | call_participants | EXPLICIT-COLUMNS (`recording_id, name, email`) | SAFE | Global search participant enrichment |
| 2 | `src/hooks/useGlobalSearch.ts:429` (`fetchParticipantMatchRecordingIds`) | call_participants | EXPLICIT-COLUMNS (`recording_id`) | SAFE | |
| 3 | `src/hooks/useGlobalSearch.ts:482` (`fetchContactSearchResults`) | contacts | EXPLICIT-COLUMNS (`id, email, name, last_seen_at, updated_at, created_at`) | SAFE | |
| 4 | `src/services/transcript-filters.service.ts:173` | call_participants | EXPLICIT-COLUMNS (`recording_id`) | SAFE | Email-based participant filter |
| 5 | `src/services/transcript-filters.service.ts:187` | call_participants | EXPLICIT-COLUMNS (`recording_id`) | SAFE | Name-based participant filter |
| 6 | `src/hooks/useCallAnalytics.ts:88` | call_speakers | EXPLICIT-COLUMNS (`speaker_id, speakers!inner(user_id)`) | SAFE | Legacy analytics join; see call_speakers section below |
| 7 | `src/hooks/useCallAnalytics.ts:125` | call_speakers | AGGREGATE (`select('*', {count:'exact', head:true})`) | SAFE | `head:true` returns zero rows — count only, `*` never materializes |
| 8 | `src/hooks/useContacts.ts:111` (`fetchAllParticipantStatsRows`) | call_participants | EXPLICIT-COLUMNS (`name, email, participant_type, recording_id, sources, recordings(recording_start_time)`) | SAFE | |
| 9 | `src/hooks/useContacts.ts:436` | call_participants | EXPLICIT-COLUMNS (`name, email, participant_type, recording_id, sources`) | SAFE | Email-match branch |
| 10 | `src/hooks/useContacts.ts:446` | call_participants | EXPLICIT-COLUMNS (same as #9) | SAFE | Name-only-match branch |
| 11 | `src/hooks/useContacts.ts:497` | contacts | **BARE-SELECT-STAR** (`select("*")`) | **REQUIRES-ATTENTION** | Main contacts list query (`queryKeys.contacts.list`) — feeds the People/Contacts UI's `ContactWithCallCount[]`. Adding `identity_id` WILL appear in every row here. |
| 12 | `src/hooks/useContacts.ts:652-664` (`createContactMutation`) | contacts | **BARE-SELECT-NOARGS** (`.insert(...).select().single()`) | **REQUIRES-ATTENTION** | Returns full inserted row cast `as Contact`; `identity_id` will be present (and `null`) on every newly created contact's return value. |
| 13 | `src/hooks/useContacts.ts:689` (`updateContactMutation`) | contacts | N/A (write-only, no `.select()`) | SAFE | |
| 14 | `src/hooks/useContacts.ts:737` (`deleteContactMutation`) | contacts | N/A (write-only) | SAFE | |
| 15 | `src/hooks/useContacts.ts:862` | contacts | EXPLICIT-COLUMNS (`id, last_seen_at`) | SAFE | Upsert-check-existing path |
| 16 | `src/hooks/useContacts.ts:880` | contacts | N/A (write-only `.update()`) | SAFE | |
| 17 | `src/hooks/useContacts.ts:894-903` | contacts | EXPLICIT-COLUMNS (`.insert(...).select('id')`) | SAFE | |
| 18 | `src/hooks/useContacts.ts:955` (`importAllContactsMutation`) | call_participants | EXPLICIT-COLUMNS (`email, name, recording_id`) | SAFE | Canonical-source contact import |
| 19 | `src/hooks/useContacts.ts:1019` | contacts | EXPLICIT-COLUMNS (`id, email, name, last_seen_at`) | SAFE | Dedup-check against existing contacts |
| 20 | `src/hooks/useContacts.ts:1080` | contacts | N/A (write-only `.upsert()`) | SAFE | |
| 21 | `src/hooks/useCallDetailQueries.ts:454` | call_participants | EXPLICIT-COLUMNS (`name, email, participant_type, organization_id`) | SAFE | CallDetail speaker pipeline |
| 22 | `src/hooks/useCallDetailQueries.ts:484` | contacts | EXPLICIT-COLUMNS (`id, name, email, contact_type, last_seen_at, track_health, notes, tags`) | SAFE | Email-match enrichment |
| 23 | `src/hooks/useCallDetailQueries.ts:496` | contacts | EXPLICIT-COLUMNS (same as #22) | SAFE | Name-match enrichment |
| 24 | `src/hooks/useContactSuggestions.ts:83` | call_participants (via RPC) | See SQL Table 3, `get_org_call_participant_contacts` | SAFE | Consumes an already-EXPLICIT RPC, not a raw `.from()` select |
| 25 | `src/test/rls-regression.test.ts:1140,1180` (generic `CROSS_ORG_TABLES` loop) | call_participants | **BARE-SELECT-STAR** (`.from(table).select("*").eq(filterColumn, filterValue)`) | **REQUIRES-ATTENTION** (test infra) | `call_participants` (and `call_speakers`) are registered in `CROSS_ORG_TABLES`; the assertion only checks `data.length === 0` / `error`, never individual fields — real risk is effectively nil, flagged per the letter of the classification rule. **`contacts` and `speakers` are NOT registered in this array today** (pre-existing gap, not introduced by this plan — see "Pre-existing gaps" below). |
| 26 | `src/test/rls-regression.test.ts:739,772` | call_participants | N/A (test fixture `.insert()`) | SAFE | Seeds fixture rows only |
| 27 | `src/test/event-schema-noop.integration.test.ts:243,255` | call_participants | N/A (test fixture `.insert()`) | SAFE | **This is Phase 30's own EVT-03 noop-test precedent file** — Plan 02 should mirror/extend this pattern for `identity_id` (per this plan's `read_first`) |
| 28 | `src/test/event-resolution-content-proof.integration.test.ts:171` | call_participants | N/A (test fixture `.insert()`) | SAFE | |
| 29 | `src/test/event-resolution-metadata-tier.integration.test.ts:152` | call_participants | N/A (test fixture `.insert()`) | SAFE | |

## Table 2 — Edge functions (`supabase/functions/`) call sites

| # | File:Line | Table | Select Style | Risk | Note |
|---|-----------|-------|--------------|------|------|
| 30 | `mcp-server/tools/write/set_speakers.ts:70` | call_participants | EXPLICIT-COLUMNS (`id, name, email`) | SAFE | Existing-org-speakers match check |
| 31 | `mcp-server/tools/write/set_speakers.ts:83` | call_participants | EXPLICIT-COLUMNS (`name, email`) | SAFE | Existing-recording-speakers dedup check |
| 32 | `mcp-server/tools/write/set_speakers.ts:108` | call_participants | N/A (write-only `.insert()`) | SAFE | |
| 33 | `mcp-server/tools/write/set_speakers.ts:146` | speakers | EXPLICIT-COLUMNS (`id`) | SAFE | Analytics-mirror lookup by email |
| 34 | `mcp-server/tools/write/set_speakers.ts:155` | speakers | EXPLICIT-COLUMNS (`id`) | SAFE | Analytics-mirror lookup by name |
| 35 | `mcp-server/tools/write/set_speakers.ts:164` | speakers | EXPLICIT-COLUMNS (`.insert(...).select('id').single()`) | SAFE | |
| 36 | `mcp-server/tools/write/set_speakers.ts:180` | call_speakers | N/A (write-only `.upsert()`) | SAFE | Legacy analytics mirror write |
| 37 | `mcp-server/tools/write/_ingest_helpers.ts:398` | call_participants | EXPLICIT-COLUMNS (`id, name, email`) | SAFE | Shared with `set_speakers.ts` logic (`applySpeakerNames`) |
| 38 | `mcp-server/tools/write/_ingest_helpers.ts:410` | call_participants | EXPLICIT-COLUMNS (`name, email`) | SAFE | |
| 39 | `mcp-server/tools/write/_ingest_helpers.ts:430` | call_participants | N/A (write-only `.insert()`) | SAFE | |
| 40 | `mcp-server/tools/read/get_contact_calls.ts:16` | contacts | EXPLICIT-COLUMNS (`id`) | SAFE | Existence/ownership check |
| 41 | `mcp-server/tools/read/list_contacts.ts:12` | contacts | EXPLICIT-COLUMNS (`id, name, email, contact_type, last_seen_at, track_health, notes`) | SAFE | |
| 42 | `mcp-server/tools/read/get_contact.ts:12` | contacts | EXPLICIT-COLUMNS (`id, name, email, contact_type, last_seen_at, track_health, health_alert_threshold_days, notes, tags, created_at`) | SAFE | |
| 43 | `mcp-server/tools/read/list_speakers.ts:26` | call_participants | EXPLICIT-COLUMNS (`name, email, participant_type`) | SAFE | |
| 44 | `mcp-server/tools/read/get_recording_context.ts:73` | call_participants | EXPLICIT-COLUMNS (`name, email, role`) | SAFE | **Only consumer that reads `role` instead of `participant_type`** |
| 45 | `mcp-server/tools/read/get_speaker_calls.ts:26` | call_participants | EXPLICIT-COLUMNS (`recording_id`) | SAFE | |
| 46 | `mcp-server/__tests__/set-speakers.idempotency.test.ts:50` | call_participants | N/A (meta-test: asserts source text contains a string) | SAFE | Not a real reader — asserts on source code, not data |
| 47 | `connector-sync-all/__tests__/idempotency.integration.test.ts:103,104` | call_speakers, call_participants | N/A (test cleanup `.delete()`) | SAFE | |
| 48 | `callvault-api/routes/contacts.ts:37` | contacts | EXPLICIT-COLUMNS (`id, name, email, contact_type, last_seen_at, track_health`) | SAFE | |
| 49 | `callvault-api/routes/calls.ts:250` | call_participants | EXPLICIT-COLUMNS (`name, email, participant_type`) | SAFE | |
| 50 | `callvault-api/routes/speakers.ts:70` | call_participants | EXPLICIT-COLUMNS (`name, email, participant_type`) | SAFE | |
| 51 | `zoom-sync-meetings/index.ts:327` | call_participants | EXPLICIT-COLUMNS (`name`) | SAFE | Dedup-existence check before transcript-speaker insert |
| 52 | `zoom-sync-meetings/index.ts:351` | call_participants | N/A (write-only `.insert()`) | SAFE | |
| 53 | `_shared/connector-pipeline.ts:390` | call_participants | EXPLICIT-COLUMNS (`name, email`) | SAFE | Shared transcript-speaker dedup (all 7 connectors) |
| 54 | `_shared/connector-pipeline.ts:417` | call_participants | N/A (write-only `.insert()`) | SAFE | |
| 55 | `_shared/event-resolver.ts:330` | call_participants | EXPLICIT-COLUMNS (`recording_id, email, has_confirmed_speech`) | SAFE | MATCH alibi-veto lookup |
| 56 | `_shared/event-resolver.ts:543` | call_participants | EXPLICIT-COLUMNS (`recording_id, email, name`) | SAFE | Metadata-tier matcher (MATCH-06) |

## Table 3 — SQL RPC / trigger readers (`supabase/migrations/`, LIVE definitions only)

For every function redefined more than once (`global_search`, `get_available_metadata`), only the migration containing the CURRENT LIVE version is listed — confirmed by comparing every `CREATE OR REPLACE FUNCTION` timestamp for that name. Superseded historical versions are in "Excluded" below.

| # | Function | Live Definition | Table(s) | Select Style | Risk | Call sites found |
|---|----------|-----------------|----------|---------------|------|-------------------|
| 57 | `get_people_summary(p_organization_id)` | `20260309120000_call_participants.sql:342` | call_participants (+ recordings join) | EXPLICIT-COLUMNS (`RETURNS TABLE`, explicit `cp.name`/`cp.email`/aggregates) | SAFE | **No live `.rpc()` call site found** in `src/`/`supabase/functions/` grep — only referenced in generated `src/types/supabase.ts`. Its own migration comment says "Powers the People tab" but no current caller was located; flagged as a discrepancy, not fixed (read-only inventory task). |
| 58 | `get_recordings_for_person(p_organization_id, p_email, p_name)` | `20260309120000_call_participants.sql:408` | call_participants (+ recordings join) | EXPLICIT-COLUMNS (`RETURNS TABLE`, explicit columns) | SAFE | Same no-live-caller note as #57. |
| 59 | `global_search(...)` | `20260831010000_fix_global_search_call_tag_assignments_regression.sql:61` | contacts (only table among the 4 that `global_search` touches) | EXPLICIT-COLUMNS (`jsonb_build_object('email', c.email, 'contact_type', c.contact_type, 'last_seen_at', c.last_seen_at)`, `ts_rank`) | SAFE | Called from `mcp-server/tools/read/search_calls.ts:26` and `src/test/event-schema-noop.integration.test.ts:355` |
| 60 | `get_available_metadata(p_user_id, p_metadata_type)` | `20260310000002_fix_functions_fathom_calls_to_recordings.sql:211` (`'speakers'` branch ~227-228) | speakers JOIN call_speakers | EXPLICIT-COLUMNS (`s.name AS value, COUNT(DISTINCT cs.call_recording_id)`) | SAFE | No live `.rpc()` call site found in grep (types-only reference); its own comment says "Used by chat tool #12 getAvailableMetadata" |
| 61 | `get_org_call_participant_contacts(p_organization_id)` | `20260731170541_get_org_call_participant_contacts.sql:16` | call_participants | EXPLICIT-COLUMNS (`RETURNS TABLE(email, name)`, `DISTINCT ON`) | SAFE | Called from `src/hooks/useContactSuggestions.ts:83`. `SECURITY INVOKER` (not DEFINER) — relies on `call_participants`' own RLS. |
| 62 | `user_participates_in_event(p_event_id, p_email)` | `20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql:41` | call_participants | AGGREGATE/EXISTS (`EXISTS(SELECT 1 FROM call_participants ...)`) | SAFE | Events RLS helper (Phase 30 CR-01 fix); already named in this plan's `<interfaces>` |
| 63 | `sync_recording_participant_count()` (trigger) | `20260309120000_call_participants.sql:95` | call_participants | AGGREGATE (`SELECT COUNT(*)`) | SAFE | `AFTER INSERT OR DELETE OR UPDATE` trigger on `call_participants` itself |
| 64 | `populate_participants_from_source_metadata()` (trigger) | `20260309120000_call_participants.sql:132` | call_participants | AGGREGATE/EXISTS (`SELECT 1 ... EXISTS`-style dedup checks) | SAFE | `AFTER INSERT` trigger on `recordings` that writes into `call_participants` |

### Excluded — one-time/historical migrations (not ongoing readers)

These reference the target tables but are one-shot backfill/cleanup scripts that already executed against the historical schema, or are superseded (`CREATE OR REPLACE`d away) function versions. They cannot break from a future additive column because they do not run again:

- `20260407140000_cleanup_cross_org_contacts.sql` — one-time `DELETE` cleanup of cross-org-imported contacts (verified via its own `BEGIN;`/preview-then-delete structure, not a reusable function).
- `20260407160000_backfill_zoom_recorded_by.sql` — one-time backfill of `recorded_by_email`/`recorded_by_name`.
- `20260310150000_contacts_org_scoping.sql` (line 50, the `contact_call_appearances.org_id` backfill `UPDATE`) — one-time backfill, not a function.
- `20260309200013_global_search_rpc.sql`, `20260310125000_migrate_call_recording_id_to_uuid.sql`, `20260610121000_rename_legacy_recording_id_to_fathom_provider_id.sql` — each contains a HISTORICAL `global_search` redefinition, superseded by `20260831010000` (row #59 above is the only live one).
- `20260108000004_enhance_chat_tools_metadata_filters.sql`, `20260208223800_add_get_available_metadata.sql` — HISTORICAL `get_available_metadata` redefinitions, superseded by `20260310000002` (row #60 above is the only live one).

## `call_speakers` (legacy join table) readers — documented for context, NOT gaining `identity_id`

Per Task 2's locked decision, `identity_id` is added to `speakers`, `contacts`, and `call_participants` only — `call_speakers` (the legacy many-to-many join to the BIGINT-keyed `fathom_calls`/analytics path) is unchanged. Its readers are listed here because it joins to `speakers` (which DOES gain `identity_id`) and because the plan's action explicitly requested its inclusion in the sweep:

- `src/hooks/useCallAnalytics.ts:88,125` (rows #6-7 above)
- `supabase/functions/mcp-server/tools/write/set_speakers.ts:180` (row #36, write-only mirror)
- `supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts:103` (row #47, test cleanup)
- `src/test/rls-regression.test.ts` `CROSS_ORG_TABLES` array registers `call_speakers` (line 60) alongside `call_participants` (line 61), both using the generic bare-`select("*")` isolation loop (row #25's note applies identically).
- SQL: `get_available_metadata`'s `'speakers'` branch (row #60) joins `call_speakers` but selects only `cs.call_recording_id` inside a `COUNT(DISTINCT ...)` — no column risk regardless.

None of these break from `speakers.identity_id` or `call_participants.identity_id` being added, since none of them do a bare/star select that would surface the new column on those tables (`useCallAnalytics.ts:88` selects `speaker_id, speakers!inner(user_id)` explicitly — adding `speakers.identity_id` is invisible unless the nested selector is changed to `speakers!inner(*)`, which it is not).

## Match sites for the resolver (Plan 04)

Where a verified email or provider-participant-id signal is currently stored, per table — this is what Plan 04's `resolve-identities` matcher will read:

| Table | Email column | Provider-ID column | Normalization observed | Notes |
|-------|--------------|---------------------|------------------------|-------|
| `speakers` | `email` (nullable, `UNIQUE(user_id, email)`) | **none** | Not verified at write time in this sweep — flagged by research Assumption A1, still open | User-scoped only, no org/workspace column at all |
| `contacts` | `email` (`NOT NULL`, `UNIQUE(user_id, email)`, then org-scoped via `org_id`) | **none** | Not verified at write time in this sweep (same A1 gap) | |
| `call_participants` | `email` (nullable) — migration comment states "stored lowercase" | **none** — `sources TEXT[]` records source NAMES (`'zoom_webhook'`, `'transcript'`, `'mcp_manual'`), not a provider participant ID | Confirmed lowercase-on-write intent via migration comment only, not independently verified against every insert call site in this sweep | This is the ONLY one of the three tables with a comment-documented normalization convention |

**No existing column on any of the three tables stores a provider participant ID** (e.g., a Zoom participant UUID or Fathom attendee ID) distinct from `email`/`name`. Plan 04's resolver can rely on verified `email` exact-match as the primary deterministic signal across all three tables; a provider-participant-id signal, if wanted later, does not exist today and would need a new column — out of this plan's scope to add.

## Pre-existing gaps observed (not fixed — read-only inventory task, no source modified)

- `src/test/rls-regression.test.ts`'s generic `CROSS_ORG_TABLES` cross-org isolation loop registers `call_participants` and `call_speakers`, but **`contacts` and `speakers` are not registered** (neither in the generic array nor in `BESPOKE_CLIENT_DENY_TABLES`). This predates Phase 34 and is out of this plan's scope to fix; noted so Plan 02 knows the current RLS-regression baseline before deciding whether `identities`/`identity_aliases` registration (per 34-RESEARCH.md's Wave 0 gap list) should also extend to `contacts`/`speakers`.
- `get_people_summary` and `get_recordings_for_person` (rows #57-58) have no located live caller despite being commented as production-facing ("Powers the People tab"). Not investigated further — out of scope for a read-only inventory task.

## Summary

- **64 total call sites/functions enumerated** across `src/` (29), `supabase/functions/` (27), and `supabase/migrations/` live SQL functions/triggers (8, after excluding 5 historical/superseded migrations).
- **2 REQUIRES-ATTENTION production readers** (both in `src/hooks/useContacts.ts`: the bare `select("*")` contacts-list query at line 497, and the bare no-arg `.select()` on `createContactMutation` at line 663) — both on `contacts`, both should be exercised by Plan 02's noop test.
- **1 REQUIRES-ATTENTION test-infrastructure reader** (`rls-regression.test.ts`'s generic `CROSS_ORG_TABLES` loop, bare `select("*")` on `call_participants`/`call_speakers`) — real risk assessed as negligible (isolation-only, checks row count not field shape) but flagged per the literal classification rule.
- **Zero REQUIRES-ATTENTION readers found on `speakers`** — every `speakers` read site uses explicit columns (`id` only, in all cases).
- **Zero bare/star readers found in any edge function** — every `supabase/functions/` call site across both tools (read) and write paths uses explicit columns or is write-only.
- **Zero bare/star readers found in any live SQL RPC/trigger** — `get_people_summary`, `get_recordings_for_person`, `global_search`, `get_available_metadata`, `get_org_call_participant_contacts`, `user_participates_in_event`, and both `call_participants` triggers all use explicit `RETURNS TABLE` columns or aggregate/EXISTS projections.

**Conclusion for IDENT-01:** Adding nullable `identity_id` to `speakers`, `contacts`, and `call_participants` is safe for 61 of 64 enumerated readers by construction (explicit columns or no returned shape). The 3 REQUIRES-ATTENTION readers are known, located, and characterized above — Plan 02's noop test (mirroring `event-schema-noop.integration.test.ts`'s EVT-03 precedent) should explicitly assert that `useContacts.ts`'s contacts-list query and create-mutation still return the expected `Contact` shape (plus a new, ignorable `identity_id: null`) after the migration, and that the `rls-regression.test.ts` cross-org loop still passes unmodified.
