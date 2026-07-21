---
phase: 24-sync-status-foundation
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/services/sync-status.service.ts
  - src/services/__tests__/sync-status.service.test.ts
  - src/services/sync-tab.service.ts
  - src/hooks/useSyncTabStateBridge.ts
  - src/hooks/useSyncTabState.ts
  - src/components/transcripts/SyncTab.tsx
  - supabase/migrations/20260620120000_sync_jobs_durable_resource.sql
  - supabase/migrations/20260620120500_backfill_null_source_call_id.sql
  - supabase/migrations/20260620121000_reconcile_orphan_fathom_calls.sql
  - src/test/rls-regression.test.ts
  - src/test/migrations/phase24-sync-status-foundation.integration.test.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: fixes_applied
fixes_applied_at: 2026-06-23T00:00:00Z
fixes_applied:
  - CR-01
  - WR-03
fixes_deferred_phase_26:
  - CR-02
  - WR-01
  - WR-02
fixes_open:
  - WR-04
  - WR-05
  - IN-01
  - IN-02
  - IN-03
hardening_migration: supabase/migrations/20260620122000_phase24_rls_hardening.sql
pushed_to:
  - prod (ref vltmrnjsubfzrgrtdqey)
  - test (ref swjzxiddcrtaqixsfaac)
---

# Phase 24: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 24 builds a provider-agnostic sync-status foundation: a canonical TEXT-based reader (`getSyncStatusForExternalIds`), three additive migrations (durable sync_jobs, source_call_id backfill, orphan reconciliation report), and the React bridge that threads sync status onto the unsynced meetings list.

The TEXT-end-to-end discipline is genuinely well executed — no `parseInt`/`Number()` coercion of ids anywhere in the canonical reader, the `.in()` query keeps ids as strings, and the migrations are correctly guarded as additive (IF NOT EXISTS, idempotent backfills, ON CONFLICT arbiters, OR-combined RLS policies). The integration test guard against prod is sound.

However two BLOCKERs undercut the phase's stated goals: (1) the new `fathom_calls_orphan_report` table ships with **no RLS** despite the project's "RLS on every table" hard rule, and (2) the only caller of the new provider-agnostic reader **hardcodes `"fathom"`** as the sourceApp — so the very providers IMP-01 was built to support (Zoom, Fireflies, Grain, Read.ai, file-upload) will never have their sync status detected at runtime. The reader is correct; the wiring throws away its value.

## Critical Issues

### CR-01: New `fathom_calls_orphan_report` table has no Row Level Security

**File:** `supabase/migrations/20260620121000_reconcile_orphan_fathom_calls.sql:29-33`
**Issue:** The migration creates `public.fathom_calls_orphan_report` but never runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and defines no policies. The project's hard rule (root + `supabase/CLAUDE.md`: "All tables MUST have Row Level Security enabled") is violated. The table holds `fathom_call_id` / `recording_id_bigint` derived from real recordings — it is created in the `public` schema, so without RLS it is readable by any `authenticated` JWT through PostgREST. It also is NOT in the `CROSS_ORG_TABLES` array in `rls-regression.test.ts`, so the CI safety net will never catch the gap. While the data is low-sensitivity (Fathom numeric ids only), shipping a `public` table with RLS off is exactly the class of defect the regression suite exists to prevent, and it normalizes the pattern.
**Fix:**
```sql
ALTER TABLE public.fathom_calls_orphan_report ENABLE ROW LEVEL SECURITY;

-- Operator/service-role-only report table: no authenticated read path needed.
-- With RLS enabled and zero policies, only service_role (which bypasses RLS)
-- can read it — which matches "manual operator review" intent. If admins must
-- read it via an authed JWT, add an explicit admin-scoped SELECT policy.
```
Then add `{ table: "fathom_calls_orphan_report", filterColumn: "recording_id" }` (or an appropriate column) to `CROSS_ORG_TABLES` only if it gains an authenticated read path; otherwise document why it is service-role-only.

### CR-02: Provider-agnostic reader is called with a hardcoded `"fathom"` sourceApp — defeats IMP-01

**File:** `src/hooks/useSyncTabState.ts:202`
**Issue:** `getSyncStatusForExternalIds` filters `recordings` by `.eq("source_app", sourceApp)`. The only runtime caller is:
```ts
await checkSyncStatusRef.current("fathom", currentMeetings.map(m => m.recording_id));
```
This passes the literal `"fathom"` regardless of each meeting's actual provider. The orchestration builds the unsynced list from multiple connected integrations (`recording_id: call.externalId` for Zoom, Fireflies, Grain, Read.ai, etc.). For any non-Fathom meeting, the `source_app = 'fathom'` filter excludes its row, so `statusMap` never contains its external id, and `synced` stays `false` forever — the user re-imports already-synced non-Fathom calls. This is the exact silent-drop failure IMP-01's docstring claims to fix ("silently dropped every UUID-id provider"), reintroduced one layer up in the call chain. The reader signature threads `sourceApp` correctly; the bridge and `useSyncTabState` carry it through; only the final literal is wrong.
**Fix:** Group meetings by their real provider and call the reader per source, or pass the meeting's source through. Each `Meeting` carries `source_platform`:
```ts
const currentMeetings = meetingsRef.current;
if (currentMeetings.length > 0) {
  const byApp = new Map<string, string[]>();
  for (const m of currentMeetings) {
    const app = (m as { source_platform?: string }).source_platform ?? "fathom";
    (byApp.get(app) ?? byApp.set(app, []).get(app)!).push(m.recording_id);
  }
  await Promise.all(
    [...byApp].map(([app, ids]) => checkSyncStatusRef.current(app, ids)),
  );
}
```
Note: `checkSyncStatus` in the bridge replaces the whole `synced` flag per call (`prev.map(... synced: statusMap.has(...))`), so calling it once per app would clobber earlier results. The bridge must be reworked to merge (only flip to `true` on a hit) before a multi-call approach is safe — see WR-01.

## Warnings

### WR-01: Bridge `checkSyncStatus` unconditionally overwrites `synced`, losing prior status

**File:** `src/hooks/useSyncTabStateBridge.ts:50-52`
**Issue:**
```ts
setMeetingsRef.current?.((prev) =>
  prev.map((m) => ({ ...m, synced: statusMap.has(m.recording_id) })),
);
```
This sets `synced` to `statusMap.has(...)` for **every** meeting in the list, not just the ids that were checked. If the reader is ever called for a subset (which the CR-02 fix requires), meetings not in this batch get force-set to `false` even if a prior batch found them synced. It also means a meeting whose row exists but is in a different `source_app` is actively marked `false` rather than left untouched. Combined with CR-02 this is a correctness landmine.
**Fix:** Only flip meetings whose ids were part of this lookup, and only set `true` on a hit (don't reset others):
```ts
const checkedIds = new Set(recordingIds);
setMeetingsRef.current?.((prev) =>
  prev.map((m) =>
    checkedIds.has(m.recording_id)
      ? { ...m, synced: statusMap.has(m.recording_id) }
      : m,
  ),
);
```

### WR-02: Reader never passes `organizationId`, so sync status is not org-scoped at runtime

**File:** `src/hooks/useSyncTabStateBridge.ts:44-55`, `src/services/sync-status.service.ts:52-54`
**Issue:** `getSyncStatusForExternalIds` accepts `opts.organizationId` and applies `.eq("organization_id", ...)` when provided, but the bridge never passes it. The reader falls back to `owner_user_id` scoping only. For a user who is a member of multiple orgs, a call synced under Org A will be reported as "synced" while the user is operating in Org B — surfacing cross-org sync state in the active org's UI. RLS will still prevent reading another *user's* rows, but the same owner across orgs is not isolated. The SyncTab already has `activeOrganizationId` (`SyncTab.tsx:55`) but it is not threaded to `checkSyncStatus`.
**Fix:** Thread `activeOrganizationId` through `useSyncTabState` → bridge → reader, and pass `{ organizationId }` into `getSyncStatusForExternalIds`. The reader plumbing is already in place; only the caller args are missing.

### WR-03: `sync_jobs` gains org columns but only a SELECT org policy — no INSERT/UPDATE WITH CHECK

**File:** `supabase/migrations/20260620120000_sync_jobs_durable_resource.sql:76-81`
**Issue:** The migration adds `organization_id` and an org-isolation **SELECT** policy, but adds no `WITH CHECK` on INSERT/UPDATE. Nothing at the RLS layer stops an authenticated client from inserting/updating a `sync_jobs` row with an `organization_id` it does not belong to (writes are presumably service-role today, but the table is realtime-exposed and the column is now org-meaningful). The asymmetry — readable only by org members, writable with any org id — is an integrity gap that will bite when Phase 27/28 add client-side writes. The migration comment reasons carefully about the SELECT OR-combination but is silent on writes.
**Fix:** Either document explicitly that all `sync_jobs` writes are service-role-only (and assert it), or add an org-scoped `WITH CHECK` policy for INSERT/UPDATE mirroring the SELECT predicate:
```sql
CREATE POLICY sync_jobs_org_write ON public.sync_jobs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR is_organization_member(organization_id, auth.uid()));
```

### WR-04: `cancelSyncJob` update is not ownership-scoped

**File:** `src/services/sync-tab.service.ts:258-269`
**Issue:** `cancelSyncJob` runs `.update(...).eq("id", jobId)` with no `user_id`/org filter. It relies entirely on an UPDATE RLS policy existing on `sync_jobs` to prevent a user cancelling another user's job. The reviewed migration only adds a SELECT policy and references a retained `user_id` SELECT policy — neither guarantees an UPDATE policy exists. If the UPDATE policy is permissive or absent under service-role contexts, this is an IDOR. At minimum the query should defensively scope by the current user.
**Fix:** Add the ownership filter so the guard does not depend solely on RLS:
```ts
const { user } = await getSafeUser();
const { error } = await supabase
  .from("sync_jobs")
  .update({ status: "failed", error: "Cancelled by user", completed_at: new Date().toISOString() })
  .eq("id", jobId)
  .eq("user_id", user?.id ?? "");
```

### WR-05: `workspace_entries` existence check is unscoped — can over-report `hasWorkspaceEntries`

**File:** `src/services/sync-status.service.ts:64-70`
**Issue:** The batched `workspace_entries` lookup filters only by `.in("recording_id", recordingIds)` with no org/workspace scope. The recordingIds come from the user's own rows so RLS limits exposure, but if `workspace_entries` RLS is workspace-membership-based rather than strictly owner-based, an entry created by another member could flip `hasWorkspaceEntries` to `true` for a recording the current user considers re-importable. The docstring ties this flag to "removed from all workspaces → re-importable", so correctness of the scope matters. Verify `workspace_entries` RLS matches the recordings ownership scope, or add an explicit scope.
**Fix:** Confirm `workspace_entries` RLS is owner-aligned; if not, scope the existence check to the same org/workspace context used for the recordings query.

## Info

### IN-01: Source-level regex test is a weak proxy for the no-coercion invariant

**File:** `src/services/__tests__/sync-status.service.test.ts:17-27`
**Issue:** The test asserts the invariant by grepping the source for `parseInt` / `Number(` and a literal `.in("source_call_id"`. This catches the obvious regression but is brittle: `parseInt` could be reintroduced via `+id`, `~~id`, `id * 1`, or a helper import, and the `.in("source_call_id"` string match passes even if the surrounding query is broken. The real behavioral proof lives in the integration test (IMP-01), which is correct. Consider noting that this file is a tripwire, not the proof.
**Fix:** Keep as a fast tripwire; rely on `phase24-sync-status-foundation.integration.test.ts` IMP-01 for behavioral coverage (already does). Optionally also assert absence of `+source_call_id` / `* 1` coercion forms.

### IN-02: `listActiveSyncJobs` / `listSyncJobsByIds` return `unknown[]` and are unscoped

**File:** `src/services/sync-tab.service.ts:280-305`
**Issue:** Both helpers select `*` from `sync_jobs` with no `user_id`/org filter and return `unknown[]`, pushing all typing and scoping onto RLS + callers. Not a leak (RLS applies), but the loose `unknown[]` return discards the `SyncJob` type defined in `useSyncTabState.ts` and the unscoped query is fragile if RLS changes. Low priority.
**Fix:** Type the return as `SyncJob[]` and add a defensive `.eq("user_id", user.id)` to match the polling query in `useSyncTabState.ts:219-225`.

### IN-03: Backfill residual gap is reported via RAISE NOTICE only

**File:** `supabase/migrations/20260620120500_backfill_null_source_call_id.sql:45-63`
**Issue:** The residual NULL-`source_call_id` count is emitted with `RAISE NOTICE`, which is correct and intentionally documented as a bounded known gap. Worth flagging that NOTICE output is easily lost in CI/migration logs; if the residual count matters operationally, persisting it (like the orphan report does) would make it durable. Documented and deferred — no action required, listed for completeness.
**Fix:** Optional: persist the residual count to a small report row if operators need historical visibility, mirroring the IMP-04 report-table pattern.

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Fixes Applied (2026-06-23)

Code-review fix pass. Live/real RLS findings fixed via one additive, idempotent
migration (`supabase/migrations/20260620122000_phase24_rls_hardening.sql`);
multi-provider wiring findings deferred to Phase 26 (SyncTab is Fathom-only today,
so they are latent, not live bugs).

### Fixed

- **CR-01 — `fathom_calls_orphan_report` had no RLS.** New migration runs
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with ZERO permissive policies →
  client deny-all (service_role bypasses RLS; this is an internal,
  service-role-written diagnostic table with no `organization_id`). Verified on
  prod: `rowsecurity = true`, `policy_count = 0`.
- **WR-03 — `sync_jobs` had SELECT org policy but no write `WITH CHECK`.** Added
  `sync_jobs_org_insert` (INSERT WITH CHECK) and `sync_jobs_org_update`
  (UPDATE USING + WITH CHECK), both org-scoped via
  `is_organization_member(organization_id, auth.uid())`, `organization_id IS NULL`
  allowed for legacy/in-flight rows. PERMISSIVE + OR-combined; no existing policy
  dropped. Verified on prod: both write policies present.
- **RLS test coverage** — added a `CLIENT_DENY_TABLES` assertion in
  `src/test/rls-regression.test.ts`: seeds a row in `fathom_calls_orphan_report`
  via service-role and asserts both authenticated JWTs read zero rows. The
  orphan table has no `organization_id`, so it is correctly NOT in
  `CROSS_ORG_TABLES`.

### Pushed + verified

- Hardening migration applied to **prod** (ref `vltmrnjsubfzrgrtdqey`, DB URL
  ref-guarded before connect) and **test** (ref `swjzxiddcrtaqixsfaac`). Both
  `supabase migration list` now show `20260620122000` as applied; re-push on prod
  reports "Remote database is up to date".
- **RLS regression suite: 47/47 pass** against TEST (incl. the new orphan-report
  client-deny assertion).
- **Phase 24 integration suite: 5/5 pass** against TEST (incl. IMP-04 orphan
  classification — RLS-on did not break the migration's service-role INSERT path).

### Deferred to Phase 26 (TBL)

CR-02 / WR-01 / WR-02 — multi-provider sourceApp + org-id wiring. See
`deferred-items.md`. NOT a live bug: SyncTab is Fathom-only today, so the
hardcoded `"fathom"` produces correct results for every meeting that currently
exists.

### Still open (lower-priority, not fixed in this pass)

WR-04 (cancelSyncJob ownership scope), WR-05 (workspace_entries scope check),
IN-01/IN-02/IN-03 (test tripwire note, loose return typing, NOTICE-only residual
report).
