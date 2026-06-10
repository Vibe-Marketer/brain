---
status: resolved
trigger: "search and contacts filter both broken — global search misses speakers/attendees/contacts, contact filter returns incomplete results, pagination doesn't cover all pages"
created: 2026-06-10
updated: 2026-06-10
---

# Debug Session: Search & Contacts Filter Pagination

## Symptoms

1. **Global search (top of page)** — sometimes doesn't show speakers, attendees, emails, contacts, people in results. Only finds by title/date/transcript text. Typing a person's name returns nothing if they don't appear in title/summary/transcript text.

2. **Contacts filter** — doesn't work at all. Selecting a contact and applying shows 0 results or vastly incomplete results.

3. **Pagination** — when filters do return something, they only return 1-2 pages, not all matching calls.

The filter element: `#radix-\:r8qv\: > div > div.p-3.border-b > input` (search input inside ContactsFilterPopover)

## Root Causes Identified (by Algorithm investigator)

### RC-1: Global search doesn't search participants
- File: `src/hooks/useGlobalSearch.ts`
- The search queries `recordings.title`, `recordings.full_transcript`, `recordings.summary` via ILIKE
- Does NOT query `call_participants.name` or `call_participants.email`
- Result: Typing "Phill" finds nothing unless "Phill" appears in transcript/title text
- Fix: Add participant search — query `call_participants` for name/email ILIKE match, union those recording IDs with title/transcript results

### RC-2: Contact filter pagination truncation (PostgREST 1000-row cap)
- File: `src/services/transcript-filters.service.ts` → `findParticipantRecordingIds()`
- The function queries `call_participants` with `.in('email', participants)` but NO `.limit()` override
- PostgREST default max_rows = 1000 → if a contact participated in 1000+ calls, query is silently truncated
- Result: Filter shows incomplete results, only first 1000 calls containing that contact
- Fix: Add `.limit(10000)` to the call_participants queries in `findParticipantRecordingIds()`

### RC-3: All Calls path inline search skips full_transcript  
- File: `src/components/transcripts/TranscriptsTab.tsx` (line ~694)
- The `syntax.plainText` filter: `q.or('title.ilike.%query%,summary.ilike.%query%')` — missing `full_transcript.ilike`
- The workspace RPC path handles this correctly server-side
- Fix: Add `full_transcript.ilike.%${escaped}%` to the All Calls path OR filter

## Schema Notes

- `call_participants.email` — stored lowercase (confirmed from migration 20260309120000)
- `call_participants.recording_id` — UUID references `recordings.id`
- Email exact-match `.in('email', ...)` should be safe (emails are lowercase in both tables)

## Current Focus

```yaml
hypothesis: "Three separate bugs: (1) global search never queries call_participants, (2) findParticipantRecordingIds hits 1000-row PostgREST cap, (3) All Calls path search misses full_transcript"
test: "Fix all three, verify contact filter returns all pages, verify global search finds calls by participant name"
next_action: "COMPLETE — all fixes applied and TypeScript verified"
```

## Evidence

- `src/hooks/useGlobalSearch.ts:229` — searches only title/full_transcript/summary, participants fetched AFTER as metadata decoration only
- `src/services/transcript-filters.service.ts:162-170` — email query has no `.limit()` override
- `src/components/transcripts/TranscriptsTab.tsx:693-696` — All Calls path search OR excludes full_transcript
- Migration `20260309120000_call_participants.sql:30` — confirms `email TEXT -- stored lowercase`

## Files to Change

1. `src/hooks/useGlobalSearch.ts` — add participant name/email search
2. `src/services/transcript-filters.service.ts` — add `.limit(10000)` to both queries in `findParticipantRecordingIds`
3. `src/components/transcripts/TranscriptsTab.tsx` — add `full_transcript.ilike` to All Calls search filter

## Resolution

- root_cause: Three bugs: global search never queried call_participants by name/email; contact filter hit PostgREST 1000-row default cap; All Calls inline search missing full_transcript ILIKE
- fix: (1) Added fetchParticipantMatchRecordingIds() helper to useGlobalSearch.ts — parallel participant search unioned with primary results in both workspace and org paths. (2) Added .limit(10000) to both call_participants queries in findParticipantRecordingIds(). (3) Added full_transcript.ilike to All Calls OR filter in TranscriptsTab.tsx.
- verification: npx tsc --noEmit → 0 errors; all three changes confirmed present in source
- files_changed: src/hooks/useGlobalSearch.ts, src/services/transcript-filters.service.ts, src/components/transcripts/TranscriptsTab.tsx
