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

Pending.

## Task 3: Edge Deploy, Real-DB Regression, and Cleanup

Pending.

## Final Gate

`TEST-SCHEMA-GATE: PENDING`
