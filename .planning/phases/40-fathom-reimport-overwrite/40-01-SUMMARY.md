---
plan: 40-01
status: complete
completed: 2026-05-12
---

# Plan 40-01 — Summary

New edge function `supabase/functions/fathom-refresh/index.ts` (550 lines) that force-refreshes a single Fathom call. Models after Phase 39 `fathom-reconcile` but single-call only — no bulk, no cron path.

**What it does:**
- JWT auth (rejects missing/invalid bearer)
- Verifies `recordings.owner_user_id === userId` (returns 404 not 403 to prevent existence-leak)
- Rejects non-Fathom recordings (`NOT_A_FATHOM_CALL`)
- Resolves user's active Fathom `import_source`, refreshes OAuth token if expired
- Fetches latest meeting via `FathomClient.fetchWithRetry` — Strategy A (`recording_id` filter), Strategy B (paginate around `recording_start_time`)
- Normalizes transcript (consolidate consecutive same-speaker segments) + summary + duration
- `UPDATE recordings SET title, full_transcript, summary, duration, recording_end_time, synced_at, source_metadata WHERE id = ? AND owner_user_id = ?`
- `UPSERT fathom_raw_calls ON CONFLICT (recording_id, user_id)`

**Error matrix:** 401 / 400 / 404 / 429 (with Retry-After) / 500 — all 6 codes from CONTEXT.md.

**Tests:** 12/12 contract assertions green.
