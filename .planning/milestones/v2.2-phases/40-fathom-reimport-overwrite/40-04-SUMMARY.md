---
plan: 40-04
status: complete
completed: 2026-05-12
---

# Plan 40-04 — Summary

`src/test/migrations/phase40-fathom-refresh.integration.test.ts` (353 lines, 4 tests) hits a real Supabase DB via service-role key. Uses the donor pattern (Phase 39 precedent) — finds an existing user with fathom data so the test doesn't need `auth.users` admin perms.

| Test | Asserts |
|------|---------|
| `overwrites ONLY ...` | UPDATE touches exactly title/full_transcript/summary/duration/recording_end_time/synced_at/source_metadata. id, org_id, owner_user_id, legacy_recording_id, source_app, source_call_id, created_at byte-for-byte unchanged. |
| `preserves workspace_entries, folder_assignments, call_tag_assignments` | Row counts unchanged after refresh. |
| `upserts fathom_raw_calls on composite key` | Second upsert overwrites instead of creating a duplicate (composite ON CONFLICT). |
| `cross-org caller — UPDATE matches zero rows` | `eq('owner_user_id', fakeUserId)` returns empty; real title untouched. |

**Result:** 4/4 PASS on prod DB. Cleanup is idempotent (re-runs cleanly).

The HTTP path (OAuth flow + Fathom API roundtrip) is verified by the contract test in 40-01 plus operator-driven dev-browser verification after deploy — same pattern as Phase 39.
