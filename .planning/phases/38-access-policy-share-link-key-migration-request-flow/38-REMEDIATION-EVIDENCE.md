---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "17"
checked_at: 2026-09-20T00:55:59Z
branch: v2.2-event-resolution
test_ref: swjzxiddcrtaqixsfaac
production_ref: vltmrnjsubfzrgrtdqey
status: pass
---

# Phase 38 Remediation Evidence

Plan 17 closed the two blockers from the stopped Plan 16 rollout. Production
was accessed only for aggregate, redacted, read-only inventory. No production
row, schema object, function, branch, or frontend deployment was changed.

## Guarded Historical Migration

Commit `0c654dec` changed only the unconditional table comment in
`20260919000003_phase38_share_link_uuid_bridge.sql`. The replacement
`DO $comment_guard$` block checks
`to_regclass('public.call_share_access_log')` before issuing the same comment.
The source diff is 11 inserted and 2 removed lines at that one statement; all
bridge columns, backfill logic, constraints, indexes, RPCs, grants, inventory,
and token behavior remain byte-for-byte unchanged.

The transactional TEST replay passed in both historical shapes:

- with `call_share_access_log` absent, 00003 completed and 00009 recreated the
  table;
- with the table present, 00003 retained the same comment and 00009 replayed
  twice without losing rows or changing link IDs;
- every replay rolled back, leaving TEST unchanged.

This proves the 00003 guard is a semantic no-op on the existing TEST schema and
allows the forward-only repair to run after the production bridge.

## TEST Migration Apply

The secure database URL was read from the mode-0600 local file
`/tmp/callvault-phase38-test-db-url`, checked for TEST ref
`swjzxiddcrtaqixsfaac`, and rejected if it contained the production ref. Before
the apply, TEST contained Phase 38 migrations `20260919000001` through
`20260919000008`, with only `20260919000009` pending. `supabase db push` applied
only `20260919000009_phase38_restore_share_access_log.sql`.

The final `supabase migration list --db-url <guarded TEST URL>` contains the
exact ordered Phase 38 sequence `20260919000001` through `20260919000009`.

### Repaired catalog

| Assertion | Observed |
|---|---:|
| `call_share_access_log` exists | true |
| `accessed_by_user_id` nullable | true |
| RLS enabled | true |
| Foreign keys | 2 |
| Indexes, including primary key | 4 |
| Owner SELECT policies | 1 |
| Anonymous INSERT revoked | true |
| Authenticated INSERT revoked | true |
| Service-role INSERT granted | true |
| Table and accessor comments present | true |

The final read-only integrity transaction returned zero keyless share rows,
orphan UUID share rows, orphan request rows, orphan grant rows, duplicate
pending requests, duplicate active grants, orphan recording events, and orphan
participant events.

## Six-User TEST Canary

The guarded tool used exactly six reserved `phase38.invalid` users with these
roles: owner, organization administrator, team actor, coach, confirmed
participant, and invitee-only actor. The manifest remained at an explicit
mode-0600 `/tmp` path and was never committed or printed.

| Step | Redacted result |
|---|---|
| Provision | 6 auth users; isolated graph present; PASS |
| Verify | 6 auth users; 6 counted graph roots; PASS |
| Cleanup | 0 auth users; 0 graph rows; PASS |
| Verify zero residue | 0 auth users; 0 graph rows; PASS |

The real TEST run also proved that signup-created protected personal
organization/workspace rows must be removed by the exact-ID admin cleanup RPC
before deleting each exact canary auth user. No broad cleanup RPC or customer
selector was used.

## Production Read-Only Legacy Inventory

The final inventory action asserted production ref
`vltmrnjsubfzrgrtdqey`, used read-only service API queries, fetched no recording
content, and emitted only counts plus the stable local SHA-256 digest. The tool
supports the current pre-00003 production schema by falling back only when
Postgres reports that `call_share_links.recording_id` is absent; permission and
all unrelated errors still fail closed.

| Invariant | Observed | Gate |
|---|---:|---|
| Unresolved legacy-only rows | 2 | PASS |
| Source absent | 1 | PASS |
| Source present only under another owner | 1 | PASS |
| Same-owner ambiguity | 0 | PASS |
| Unsafe cross-owner UUID assignments | 0 | PASS |
| Rows with neither key | 0 | PASS |

Authorized unresolved fingerprint:
`sha256:bd0b96ecb0d08056ed8cb6fe2aca48968fb9f14cad3c31b071d1dec646a1d1bd`

The two unresolved rows remain unchanged legacy-only rows and unavailable for
content resolution. They were not repaired, reassigned, deleted, or used as
canaries.

## Pre-00009 Canary Lifecycle Compatibility

Plan 18 preflight exposed that the canary's access-log insert, residue count,
and cleanup delete assumed migration 00009 had already restored
`call_share_access_log`. The compatibility repair in `6808a454` handles only
`42P01` or `PGRST205` errors that name that exact table:

- before 00009, the log insert is not applicable, its residue count is zero,
  and cleanup proceeds through every remaining exact-ID selector;
- after 00009, the synthetic log row is inserted, counted, and deleted normally;
- permission failures, errors for other tables, and unrelated errors remain
  fatal.

The RED commit `3439a2d0` added both lifecycle shapes. The final canary contract
suite passed 10/10, the focused Phase 38 suite passed 225/225, and the real TEST
canary again proved six users/six counted graph roots before cleanup and zero
users/zero graph rows afterward. No production mutation was used to test this
repair.

## Evidence Privacy

Committed evidence contains no raw user ID, recording ID, provider key, email,
share token, database URL, service key, response payload, title, summary, or
transcript. Temporary production API-key material was stored mode 0600 and
deleted immediately after the read-only inventory processes completed.
