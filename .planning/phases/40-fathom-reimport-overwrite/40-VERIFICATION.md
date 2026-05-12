---
phase: 40
verified: 2026-05-12
status: code-complete-pending-operator-deploy
last_run: 2026-05-12
---

# Phase 40 — Verification

## Code verification (all GREEN)

| Check | Result |
|-------|--------|
| All 4 plans have committed code | OK — see git log `feat(40-01)`..`test(40-04)` |
| `fathom-refresh` edge function exists | OK — `supabase/functions/fathom-refresh/index.ts` |
| Contract test green (12 assertions) | OK — 12/12 PASS |
| Real-DB integration tests green | OK — 4/4 PASS against prod DB |
| TypeScript clean across new code | OK — `tsc --noEmit` reports zero errors for new files |
| Production build clean | OK — `npm run build` ✓ |
| UI-SPEC contract followed (icons, tokens, copy) | OK — `RiRefreshLine`/`RiLoader4Line`, semantic tokens only, locked copy verbatim |
| Phase 39 mirror invariants preserved | OK — `fathom-refresh` reads `legacy_recording_id` from `recordings` and re-upserts `fathom_raw_calls` on the same `(recording_id, user_id)` composite key |
| Phase 30 UUID/BIGINT boundary respected | OK — `FathomImportDetail` resolves row's BIGINT through `toRecordingUuid` from `src/lib/recording-ids.ts` before invoking refresh |

## Success criteria status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Refresh from Fathom" exposed in Fathom import detail panel + call detail view | PASS — both surfaces wired (CallDetailHeader.tsx + FathomImportDetail.tsx) |
| 2 | Action updates title/transcript/summary/duration without creating a duplicate | PASS — integration test `overwrites ONLY ...` + contract test `re-upserts fathom_raw_calls mirror on composite key` |
| 3 | After re-import: UUID, workspace, tags, folder assignments unchanged | PASS — integration test `preserves workspace_entries, folder_assignments, call_tag_assignments` |
| 4 | Deleted-upstream Fathom call surfaces a clear error | WIRED — edge function returns 404 `FATHOM_CALL_NOT_FOUND`; hook maps to toast "This call was deleted in Fathom. It cannot be refreshed." Live verification pending operator-driven test against a real Fathom-deleted call post-deploy. |

## Live verification (PENDING operator deploy)

| Check | Status |
|-------|--------|
| End-to-end refresh against a real Fathom call on prod | PENDING — requires `supabase functions deploy fathom-refresh --use-api` |
| Toast appears on success | PENDING (depends on deploy) |
| `FATHOM_CALL_NOT_FOUND` toast for deleted-upstream call | PENDING (depends on deploy) |
| `FATHOM_AUTH_EXPIRED` toast routes to Settings → Integrations | PENDING (depends on deploy) |
| p95 latency < 5s per refresh | PENDING (manual measure during operator verify) |

## Operator deploy runbook

```bash
# 1. Deploy the edge function (no migrations — uses existing recordings + fathom_raw_calls schema)
cd /Users/Naegele/dev/brain
supabase functions deploy fathom-refresh --use-api

# 2. Verify env vars present (inherits from existing Fathom functions)
#    Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#              FATHOM_OAUTH_CLIENT_ID, FATHOM_OAUTH_CLIENT_SECRET.
#    Optional: OAUTH_ENCRYPTION_KEY (if set, used via decrypt_oauth_tokens RPC).

# 3. Smoke test against a real Fathom call
#    a) Open app.callvaultai.com, navigate to an existing Fathom call.
#    b) Click REFRESH in the call detail header.
#    c) Confirm in the dialog.
#    d) Watch for the Sonner toast: "Refreshed from Fathom — title, transcript, and summary updated."
#    e) Confirm the title in the detail view matches Fathom's current title.

# 4. Smoke test the deleted-upstream path
#    Hard to reproduce without intentionally deleting a Fathom call. Operator
#    can manually test by hitting the function with a stale UUID whose
#    legacy_recording_id no longer exists in their Fathom account.

# 5. Re-run integration tests against prod DB to confirm idempotency
npm test -- src/test/migrations/phase40-fathom-refresh.integration.test.ts
```

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/fathom-refresh/index.ts` | NEW — 450 lines |
| `supabase/functions/fathom-refresh/__tests__/fathom-refresh.test.ts` | NEW — 75 lines |
| `src/hooks/useFathomRefresh.ts` | NEW — 124 lines |
| `src/components/dialogs/RefreshFromFathomDialog.tsx` | NEW — 87 lines |
| `src/components/call-detail/CallDetailHeader.tsx` | Modified — Refresh button + dialog wiring |
| `src/components/import/FathomImportDetail.tsx` | Modified — per-row icon button + dialog wiring + UUID resolution |
| `src/test/migrations/phase40-fathom-refresh.integration.test.ts` | NEW — 353 lines, 4 real-DB tests |

## Open follow-ups (not blocking phase close)

- **MANUAL-VERIFY (criterion #4):** Live deleted-upstream toast requires operator
  test with an actually-deleted Fathom call. Wired correctly in code; UAT pending.
- **MANUAL-VERIFY (perf):** p95 latency measure requires real Fathom roundtrip
  on prod after deploy.

No gaps found. All preservation invariants tested at the DB level.
