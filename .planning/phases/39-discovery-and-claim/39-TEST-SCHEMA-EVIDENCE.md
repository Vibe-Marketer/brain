# Phase 39 TEST Schema and Function Evidence

**Plan:** 39-08  
**Date:** 2026-09-20  
**Branch:** `v2.2-event-resolution`  
**Source commit:** `76abab9ee4cd2421ac3fc1aecc9c04d077f7d309`  
**Dedicated TEST ref:** `swjzxiddcrtaqixsfaac`  
**Rejected production ref:** `vltmrnjsubfzrgrtdqey`

This artifact contains no access tokens, database passwords, claim tokens, service-role keys, or participant email addresses.

## Exact Source Fingerprint

The working tree contained no implementation changes before TEST work. Supabase CLI link metadata under `supabase/.temp/` is the only expected local drift while the CLI is linked to TEST.

The manifest is the SHA-256 of each tracked file in the three reviewed migrations and both Phase 39 Edge Function trees, in the displayed order. The SHA-256 of the manifest itself is:

`a3c670e8f8a688910b92d08a145ef15110a2a0a5a80290fc37181ff41e49253a`

| Source | SHA-256 |
|---|---|
| `20260920000001_phase39_verified_email_discovery.sql` | `01f32365013407adf863bcf19ca183058c396025e90c543e2625a686c0f7a602` |
| `20260920000002_phase39_participation_claims.sql` | `4a21b67fdee3077c7d77ab95f96232c0f226d5c9491876dfc094e3da6fb58672` |
| `20260920000003_phase39_notification_disconnect.sql` | `3c9913b5baf351f9c4d0e8e9d6b816751f15a19e33667012cc293e6d79457915` |
| `participation-claim/__tests__/participation-claim.integration.test.ts` | `1dc82876e0da68087ed07b17e11c973045c087d8aa691a3ae0ab16187c99853c` |
| `participation-claim/index.ts` | `c57a2d6793e5dc41b9c1b32b98c9d3e7c013249457156d7009fbcd8268fdb0d6` |
| `send-participation-claim/__tests__/send-participation-claim.integration.test.ts` | `286d197abe80ef3d386127b42d103af176cb0a10f98dedc098691bbe9ff1411e` |
| `send-participation-claim/index.ts` | `40ccbe6e960acb429dbbc4339add9d14caf3aacfa590e1987bf2382e7cd55a9a` |

## Task 1: Guarded Migration Apply

### Target and allowlist guards

Before link, dry run, push, and post-apply inspection, the command wrapper compared the requested/linked ref byte-for-byte with `swjzxiddcrtaqixsfaac` and rejected `vltmrnjsubfzrgrtdqey`. The branch guard required `v2.2-event-resolution`. Exit status: **0** for the TEST link and every Supabase CLI database operation.

Only this ordered allowlist was accepted:

1. `20260920000001_phase39_verified_email_discovery.sql`
2. `20260920000002_phase39_participation_claims.sql`
3. `20260920000003_phase39_notification_disconnect.sql`

No other Phase 39 migration or Edge Function was permitted by the command wrappers.

### Pre-apply inventory and dry run

`supabase migration list --linked` proved all three approved versions were already Local=Remote on TEST. They had been applied during Plans 39-04 through 39-06 while their real-database suites were built. There were no unexpected pending migrations.

The exact committed source was replay-checked with `supabase db push --linked --dry-run`. Output:

```text
DRY RUN: migrations will *not* be pushed to the database.
Remote database is up to date.
```

The no-op result was accepted because the allowlisted versions were already present and matched local history. No migration history was rewritten and no TEST object was dropped merely to manufacture a second apply.

### Guarded push and post-apply history

Immediately before the real command, the linked-ref guard passed again. `supabase db push --linked` returned:

```text
Remote database is up to date.
```

The post-command migration inventory proved:

| Version | Local | Remote | Result |
|---|---:|---:|---|
| verified email discovery | `20260920000001` | `20260920000001` | PASS |
| participation claims | `20260920000002` | `20260920000002` | PASS |
| notification disconnect | `20260920000003` | `20260920000003` | PASS |

`MIGRATION_HISTORY_GATE: PASS`

Production received no database mutation.

## Task 2: Generated Types and Catalog Contract

### TEST-only type generation

The linked-ref guard proved `swjzxiddcrtaqixsfaac`, then `supabase gen types typescript --linked` generated 6,828 lines to a temporary file. The checked-in pre-Phase-39 file had 7,083 lines. A raw full-file replacement was rejected because TEST intentionally differs from production outside this phase:

- current checked-in contract: 109 tables and 112 functions;
- full TEST generation: 99 tables and 127 functions;
- unrelated TEST drift included 15 absent production-only tables, three older TEST-only tables, five Phase 38/internal functions, unrelated nullability, relationship, and legacy schema differences;
- raw full diff: 557 additions and 812 removals.

Instead, an extraction script copied the exact generated blocks for only the reviewed Phase 39 delta into the checked-in contract. No definition was typed by hand. The resulting diff is 225 additions, zero removals, and exactly these generated symbols:

- tables: `event_discovery_notification_ledger`, `participation_claim_invitations`;
- RPCs: `cancel_participation_claim_reminder`, `consume_my_participation_claim`, `count_my_discovered_events`, `create_or_rotate_participation_claim`, `disconnect_my_verified_email_alias`, `get_participation_claim_invitation_status`, `inspect_my_participation_claim`, `list_my_discovered_events`, `phase39_current_caller_emails`, `phase39_user_can_discover_event`, `sync_my_discovered_event_notifications`.

`GENERATED_PHASE39_DELTA_GATE: PASS`

### Live TEST catalog

Catalog inspection used the Supabase CLI's short-lived TEST database login without printing or persisting its password. Both new tables are owned by `postgres`, have RLS enabled, have FORCE RLS enabled, and expose **zero** direct `PUBLIC`, `anon`, or `authenticated` table grants.

| Table | Columns | RLS | FORCE RLS | Browser grants |
|---|---:|---:|---:|---:|
| `event_discovery_notification_ledger` | 5 | yes | yes | 0 |
| `participation_claim_invitations` | 26 | yes | yes | 0 |

The live catalog contains all reviewed constraints, including digest format, normalized email, seven-day expiry ordering, reminder-before-expiry, terminal-state shape, unique digest, unique live invitation, baseline uniqueness, and user/event ledger uniqueness. It also contains all six reviewed secondary/partial indexes, including `call_participants_email_event_confirmed_idx`.

Policies are limited to:

- service-role-only management of both private ledgers;
- the reviewed authenticated `events` SELECT policy using `phase39_user_can_discover_event(id)` or recording ownership;
- the existing service-role full-access `events` policy.

All 14 new or replaced Phase 39/Phase 38 functions are `SECURITY DEFINER`, owned by `postgres`, and have `search_path=""`. Stable versus volatile settings match their source. Defaults match the reviewed signatures, including page size 25/cursor null, reminder false, failure code null, and confirmation false. The live discovery body contains the enforced `LEAST(..., 50)` bound; claim consumption contains the row lock. No function has a `PUBLIC` or `anon` EXECUTE grant.

The execute matrix is exact:

- service-only helpers: `phase39_current_caller_emails` has no browser/service execute grant; the three subject-bearing Phase 38 helpers and reminder-cancel RPC grant only `service_role`;
- authenticated caller RPCs: create/status/inspect/consume/disconnect grant only `authenticated`;
- caller plus service RPCs: count/list/user-can-discover/sync grant `authenticated` and `service_role`.

### Legacy People compatibility

The canonical legacy migration does not appear in any Phase 39 migration. Live TEST signatures/results remain:

- `get_people_summary(p_organization_id uuid)` -> the original six-column result, definition MD5 `88ec63ba523d2fbdf47e7bd427499710`;
- `get_recordings_for_person(p_organization_id uuid, p_email text DEFAULT NULL, p_name text DEFAULT NULL)` -> the original eight-column result, definition MD5 `92e45adc75c25d8e6f97b6e1f1599359`.

Their pre-existing catalog ACL and `search_path=public` are unchanged. The real-database suite separately asserts their authenticated result keys.

`CATALOG_SECURITY_GATE: PASS`

### Static and type gates

- Phase 39 migration contract: **9/9 passed**.
- `npm run type-check`: **PASS**, 0 new errors against the registered baseline.
- Four Wave 0 tests used ES2021-only `replaceAll` under an ES2020 target and one test required the compiler's explicit `unknown` bridge. Those five pre-existing Phase 39 test errors were corrected.
- Adding 225 generated declarations pushed one more existing `useTeamMembers.ts` PostgREST chain over TypeScript's generic-instantiation limit. The established structural TS2589 baseline count changed from 10 to 11; no application behavior or team-membership code changed.

## Task 3: Edge Deploy, Real-DB Regression, and Cleanup

Pending.

## Final Gate

`TEST-SCHEMA-GATE: PENDING`
