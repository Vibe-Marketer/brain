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

Pending.

## Task 3 — Generated types and production relink proof

Pending.
