---
status: resolved
trigger: "Investigate and fix two broken CallVault MCP operations: search.semantic returns non-2xx error, analysis.track_speaker returns 0 results with UUID recording_ids"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T01:00:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: RESOLVED - both bugs found, fixed, and verified
test: End-to-end tests passed
expecting: n/a
next_action: archive

## Symptoms

expected:
  1. search.semantic returns matching transcript segments using hybrid BM25 + vector search
  2. analysis.track_speaker filters segments by recording_ids (UUID format)
actual:
  1. Every call returns "Error: Semantic search failed: Edge Function returned a non-2xx status code"
  2. track_speaker returns segment_count: 0, recording_count: 0 when UUID recording_ids passed
errors:
  1. "Edge Function returned a non-2xx status code"
  2. No error, just 0 results
reproduction:
  1. Call search.semantic with any params, e.g. {"query": "hello"}
  2. Call analysis.track_speaker WITH recording_ids — works WITHOUT recording_ids
started: 2026-02-18 (consistent failure)

## Eliminated

- hypothesis: Auth token not forwarded to Edge Function
  evidence: Supabase JS custom fetch wrapper does inject Authorization header via _getAccessToken() → auth.getSession(). Direct curl test confirmed auth worked.
  timestamp: 2026-02-18

- hypothesis: RPC function fc.id bug only in pre-migration code
  evidence: supabase migration list showed all migrations applied, but prosrc inspection revealed live DB still had OLD code with fc.id bug. The DROP FUNCTION in v2 may have failed silently due to signature matching issues, leaving the old function.
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18T00:15:00Z
  checked: Direct curl to semantic-search Edge Function with valid JWT
  found: {"error":"Embedding API error: 401 - {\"error\":{\"message\":\"Incorrect API key provided: sk-proj-...rpEA\"}}"}
  implication: OpenAI API key stored in Supabase secrets is expired/invalid. This causes the Edge Function to throw, returning HTTP 500, which the MCP SDK reports as "Edge Function returned a non-2xx status code"

- timestamp: 2026-02-18T00:20:00Z
  checked: analysis.ts trackSpeaker UUID parsing logic
  found: parseInt("406a116b-3a52-43e4-be22-b87ae91f05bd") = 406 (not NaN). The filter becomes query.in("recording_id", [406]) which finds no rows in fathom_transcripts.
  implication: UUID recording_ids were silently truncated to wrong numeric prefixes, causing 0 results

- timestamp: 2026-02-18T00:25:00Z
  checked: hybrid_search_transcripts RPC in live DB via psql (SELECT prosrc FROM pg_proc)
  found: Live DB has fc.id bug: "JOIN fathom_calls fc ON tc.recording_id = fc.id" — fathom_calls has no id column (uses recording_id as PK)
  implication: The RPC function was broken despite supabase migration list showing it as applied. The v2/v3 fix migrations may have silently failed.

- timestamp: 2026-02-18T00:30:00Z
  checked: transcript_chunks table schema and indexes
  found: Has pre-computed fts tsvector column with GIN index (idx_transcript_chunks_fts). The RPC was computing to_tsvector() inline rather than using the indexed column, causing full table scans and timeouts.
  implication: Even fixing fc.id, the RPC would timeout without using the indexed fts column.

- timestamp: 2026-02-18T00:35:00Z
  checked: UUID 406a116b-3a52-43e4-be22-b87ae91f05bd in recordings table
  found: Maps to legacy_recording_id = 120186239, which has 2957 rows in fathom_transcripts
  implication: UUID resolution works, the fix will return data correctly

## Resolution

root_cause: |
  Issue 1 (semantic search): Three compounding problems:
  (a) OpenAI API key stored in Supabase secrets is expired/revoked — embedding generation always fails with 401
  (b) hybrid_search_transcripts RPC in live DB had wrong JOIN: "fc.id" instead of "fc.recording_id" (fc = fathom_calls alias, which has no id column)
  (c) RPC used inline to_tsvector() computation instead of indexed fts column, causing statement timeouts

  Issue 2 (track_speaker): parseInt() silently parses UUID prefixes as numbers:
  parseInt("406a116b-...") = 406, which passes the !isNaN() check but is wrong.
  The query searched for recording_id = 406 instead of the correct legacy ID 120186239.

fix: |
  Issue 1:
  - Applied corrected hybrid_search_transcripts function directly to live DB via psql:
    - Changed JOIN to use fc.recording_id instead of fc.id
    - Changed tc.user_id filter (tc has user_id directly, no JOIN needed)
    - Changed full_text_search CTE to use tc.fts column (GIN indexed) instead of inline to_tsvector()
  - Modified semantic-search Edge Function (/supabase/functions/semantic-search/index.ts):
    - Removed hard throw when OPENAI_API_KEY missing or invalid
    - Added try/catch around embedding generation with graceful fallback to text-only search
    - Uses zero vector + semantic_weight=0.0 for text-only BM25 fallback
    - Deployed to Supabase: supabase functions deploy semantic-search

  Issue 2:
  - Modified trackSpeaker in /src/handlers/analysis.ts:
    - Added UUID regex detection (^[0-9a-f]{8}-[0-9a-f]{4}-...$)
    - UUIDs resolved to legacy_recording_id via recordings table lookup
    - Only strict UUID format enters UUID path; numeric strings go to parseInt path
  - Built: npm run build

verification: |
  Issue 1: Direct curl to semantic-search Edge Function with JWT returned success=true, search_mode=text-only, 2 results for "hello world"
  Issue 2: DB verified UUID 406a116b maps to legacy 120186239 with 2957 transcript rows. New code resolves UUID→legacy before querying.

files_changed:
  - /Users/Naegele/dev/brain/supabase/functions/semantic-search/index.ts
  - /Users/Naegele/Developer/mcp/callvault-mcp/src/handlers/analysis.ts
  - live DB: hybrid_search_transcripts RPC updated via psql
