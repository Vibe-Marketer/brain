# Phase 38 Dedicated Test Schema Evidence

## Execution identity

- **Captured:** 2026-09-19
- **Branch:** `v2.2-event-resolution`
- **Source SHA before apply:** `ece9d964dd882dec703ec6ff3cb2e16abc841f5e`
- **Supabase CLI:** `2.101.0` (the installed version was used; no upgrade or package change)
- **Dedicated test project:** `swjzxiddcrtaqixsfaac` (`callvault-test`)
- **Production project rejected by the apply guard:** `vltmrnjsubfzrgrtdqey` (`callvault-ai`)

## Task 1 — Target guard and exact migration apply

### Independent target checks before apply

1. `supabase/.temp/project-ref` read exactly `swjzxiddcrtaqixsfaac` and was asserted unequal to the production ref.
2. `supabase projects list` marked the following project active:

```text
● | swjzxiddcrtaqixsfaac | callvault-test
```

The active row did not contain the production ref. The push command was inside the same fail-closed shell gate as both checks.

### Before history

`supabase migration list --linked` showed all prior local migrations through `20260910010000` matched remotely. The only local-only rows were the four reviewed Phase 38 versions:

```text
Local          | Remote
20260919000001 |
20260919000002 |
20260919000003 |
20260919000004 |
```

There were no remote-only rows, repair prompts, or other pending local migrations.

### Dry run allowlist

`supabase db push --linked --dry-run` produced exactly this ordered set, and a shell equality check compared it byte-for-byte with the reviewed allowlist before the real push:

```text
20260919000001_phase38_access_policy_schema.sql
20260919000002_phase38_access_policy_rls_rpcs.sql
20260919000003_phase38_share_link_uuid_bridge.sql
20260919000004_phase38_copy_event_preservation.sql
```

### Apply result

```text
Applying migration 20260919000001_phase38_access_policy_schema.sql...
Applying migration 20260919000002_phase38_access_policy_rls_rpcs.sql...
Applying migration 20260919000003_phase38_share_link_uuid_bridge.sql...
Applying migration 20260919000004_phase38_copy_event_preservation.sql...
Finished supabase db push.
```

### After history

The immediate post-apply `supabase migration list --linked` showed all four rows matched Local=Remote:

```text
20260919000001 | 20260919000001
20260919000002 | 20260919000002
20260919000003 | 20260919000003
20260919000004 | 20260919000004
```

No unrelated migration was pushed or repaired. No production command was run during the apply.

## Task 2 — Live catalog and real-database proof

All catalog queries and tests in this section were run while both the local ref file and the independently parsed active row from `supabase projects list` identified `swjzxiddcrtaqixsfaac`. The production ref was rejected by the same shell guard.

### Catalog shape and lifecycle integrity

- The access-policy columns, UUID share bridge, constraints, foreign keys, and supporting indexes from migrations 01 and 03 are present with the reviewed types and nullability.
- `recording_access_requests`, `recording_access_grants`, `recording_access_audit_log`, and `recording_access_email_outbox` each report both `relrowsecurity=true` and `relforcerowsecurity=true`.
- Requests and grants expose authenticated `SELECT` policies only; audit and outbox expose service-role `ALL` policies only.
- Client roles have no `INSERT`, `UPDATE`, or `DELETE` grant on either lifecycle table, and no client table privilege on audit or outbox. The real-DB suite independently proved all twelve denied mutation cases.
- `user_notifications` has no anon/authenticated `INSERT` table grant and its only INSERT policy is scoped to `service_role`. Existing user-owned SELECT/UPDATE/DELETE behavior remains available for notification reading and dismissal.
- All 18 reviewed `SECURITY DEFINER` functions report `search_path=""`; none of the 19 reviewed new/replaced function rows grants EXECUTE to PUBLIC or anon.
- `route_recording_cross_org` reports only `postgres` and `service_role` EXECUTE, with `search_path=""` and `statement_timeout=60s`.
- All three copy/routing definitions preserve `v_source.event_id` and the data-movement suite proves the event survives every signature.

Two correctness issues surfaced only after the live apply and were fixed in the reviewed migration source, then re-applied to the dedicated test project without changing migration history or touching production:

1. `route_recording_cross_org` also revoked the inherited authenticated EXECUTE privilege.
2. The nested `ensure_recording_home_entry` trigger function was pinned to an empty search path and its `workspaces`/`workspace_entries` references were schema-qualified. This was required because the hardened copy RPCs call the trigger under an empty search path.

### Share compatibility evidence

The dedicated test project contained no historical `call_share_links` rows at apply time, so the apply-time inventory was:

```text
total=0 unresolved=0 ambiguous=0
```

The post-migration fixture therefore provides the available compatibility proof: the legacy row keeps the same ID, token, recipient, status, and access-log relationship; anonymous safe-subset resolution, correct-recipient/owner access, wrong-recipient rejection, and expired-list filtering all pass. The UUID-native create/resolve/list/revoke application path remains an intentional expected-failure marker owned by Plan 38-07; its schema prerequisites are present.

### Test results

```text
Phase 38 access-policy real DB:       80 passed, 0 skipped
Migration source + lifecycle RLS:     91 passed, 0 skipped
Copy/routing data movement:            7 passed, 0 skipped
Share compatibility bridge:           10 passed, 0 skipped
Public-recording focused contract:      7 passed, 0 skipped
Complete integration command:         232 passed, 19 skipped (34 files: 32 passed, 2 skipped)
```

The 19 full-suite skips are pre-existing credential/Edge deployment guards outside the Phase 38 schema gate. Every Phase 38 policy, fixture-matrix, boundary, RLS, share-compatibility, and copy/routing case ran. The complete provider/event-kind matrix, positive-webinar suppression, neutral-unknown passage, verified-participant denials, and independent 49/50 boundaries passed. A stale `it.fails` marker on the already-working generic unavailable response for missing/malformed public-recording IDs was normalized and passed as a regular test in both the focused run and full suite.

## Task 3 — Generated types and production relink proof

### Type generation and full-diff review

Types were generated with installed Supabase CLI `2.101.0` while the CLI and active project marker still identified the proven test ref. The raw generated file was preserved temporarily and compared in full with the committed contract.

The raw generator also surfaced older test/project drift unrelated to these four migrations (779 additions and 895 deletions). That full replacement was rejected. Only the reviewed Phase 38 delta was transferred from the generated output:

- nullable legacy plus canonical UUID keys for `call_share_links`, including the new recording FK;
- all four access lifecycle tables and their relationships;
- `recordings.access_level` and `recordings.access_policy_origin`;
- `user_settings.default_recording_access_level`;
- the access-policy, event-discovery, lifecycle, and UUID-share RPC signatures installed by migrations 01–03.

Pre-existing nullability and relationship drift outside that allowlist was left unchanged. The existing `RecordingDetail` alias was narrowed to the columns its query actually selects, removing a stale full-row mismatch exposed when the two new non-null recording fields entered the generated row type.

```text
npm run type-check
TYPE CHECK PASSED: 0 new errors.
Baseline errors remaining: 319/321.
```

### Production relink, read-only proof

After generation and type review, the CLI was relinked to production without any push or deployment. Both final checks identified:

```text
supabase/.temp/project-ref = vltmrnjsubfzrgrtdqey
active project marker       = vltmrnjsubfzrgrtdqey (callvault-ai)
```

The only production database operation was `supabase migration list --linked`. Its final rows prove all four Phase 38 migrations remain local-only/pending:

```text
20260919000001 | [pending]
20260919000002 | [pending]
20260919000003 | [pending]
20260919000004 | [pending]
```

No production migration, function deployment, frontend deployment, or data mutation occurred.
