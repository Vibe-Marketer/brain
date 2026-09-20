---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "16"
checked_at: 2026-09-19T23:34:14Z
branch: v2.2-event-resolution
target_ref: vltmrnjsubfzrgrtdqey
status: stop-before-mutation
---

# Phase 38 Production Deployment Evidence

The production rollout stopped during the mandatory read-only preflight. No
migration was applied and no Edge Function was deployed. The stop was required
because production has no recording carrying the exact approved noncustomer
canary marker and two legacy share rows do not have a unique owner-scoped
recording match. Customer data was not used as a substitute.

## Final Disposition

- **Result:** STOP before mutation
- **Failed assertions:** marked noncustomer canary count must be at least one;
  unresolved owner-scoped legacy share matches must be zero
- **Containment:** no database push, function deployment, frontend deployment,
  branch merge, or Git push was run
- **Forward fix:** deliberately provision a noncustomer recording with
  `source_metadata.integration_test = phase-38-production-canary`, and reconcile
  the two unresolved legacy share rows through a reviewed additive change or
  approved data-repair procedure before rerunning Plan 38-16
- **Rollback state:** no rollback is needed because production was not mutated

PRODUCTION-SERVER-GATE: STOP

## Immutable Source and Branch Gate

| Guard | Observed | Result |
|---|---|---|
| Branch | `v2.2-event-resolution` | PASS |
| Verified source commit | `345b8fef0d1324281a5d5203bd7665da2f898e77` | PASS |
| Verified source commit is an ancestor of HEAD | yes | PASS |
| Current HEAD | `b864601b59a10348a3c9ab693a5cd2b2224608c3` | PASS |
| Expected non-planning fingerprint | `3e006ebf4857978ab3553c3209b5bf88f95be190` | PASS |
| Recomputed non-planning fingerprint | `3e006ebf4857978ab3553c3209b5bf88f95be190` | PASS |
| Tracked, staged, and untracked non-planning paths | clean | PASS |
| `npm run build` | 4,839 modules transformed; exit 0; 7.12s | PASS |

No package install occurred. The build produced only existing documented chunk
size and dynamic/static import warnings.

## Production Target Proof

Three independent checks identified the authorized production project:

1. `supabase/.temp/project-ref` equals `vltmrnjsubfzrgrtdqey`.
2. `supabase projects list` marks `vltmrnjsubfzrgrtdqey` / `callvault-ai` as the linked project; the TEST ref `swjzxiddcrtaqixsfaac` was not linked.
3. The linked pooler connection username contains `vltmrnjsubfzrgrtdqey`; only the ref match and pooler hostname suffix were inspected, with no password printed or stored in this evidence.

## Release Boundary Before and After

Origin main before: cf63a53ea12ad9ed1628f43dfa41aa00257732b5
Origin main after: cf63a53ea12ad9ed1628f43dfa41aa00257732b5
Production frontend before: GitHub deployment 6377574967 | cf63a53ea12ad9ed1628f43dfa41aa00257732b5 | https://app.callvaultai.com
Production frontend after: GitHub deployment 6377574967 | cf63a53ea12ad9ed1628f43dfa41aa00257732b5 | https://app.callvaultai.com

The production URL returned HTTP 200 from Vercel. The deployment record was
created at `2026-09-10T17:38:45Z`. The main ref and frontend deployment stayed
byte-for-byte equal because this execution did not invoke Git push, Vercel, or
any frontend release action.

## Exact Migration Preflight

`supabase migration list --linked` showed the pending set was exactly these
eight local-only migrations, in order, with no earlier, missing, or unexpected
pending migration:

1. `20260919000001_phase38_access_policy_schema.sql`
2. `20260919000002_phase38_access_policy_rls_rpcs.sql`
3. `20260919000003_phase38_share_link_uuid_bridge.sql`
4. `20260919000004_phase38_copy_event_preservation.sql`
5. `20260919000005_phase38_authorization_review_fixes.sql`
6. `20260919000006_phase38_participant_evidence_recompute.sql`
7. `20260919000007_phase38_legacy_share_management.sql`
8. `20260919000008_phase38_notification_contracts.sql`

They remain pending. `supabase db push --linked` was not run.

## Pre-rollout Edge Function State

| Function | Production state before | Version | Deployment ID | Bundle fingerprint |
|---|---|---:|---|---|
| `share-call` | ACTIVE; JWT gateway verification disabled per repo config | 215 | `17b2e257-1836-4b5d-8cce-a35301670a6f` | `e89c112a3892...` |
| `mcp-server` | ACTIVE; JWT gateway verification disabled per repo config | 250 | `290f67b4-e4d4-43d9-9e0f-4725eed53324` | `446f5549af83...` |
| `public-recording` | not deployed | none | none | none |
| `recording-access` | not deployed | none | none | none |

The compatible production application ref recorded for rollback comparison is
`origin/main` at `cf63a53ea12ad9ed1628f43dfa41aa00257732b5`.
No function deployment command was run, so these versions remain unchanged.

## Read-only Production Data and Catalog Preflight

The checks were executed through `supabase db query --linked` inside
`BEGIN READ ONLY` / `COMMIT`. Only aggregate counts and catalog booleans were
returned.

| Probe | Result | Gate |
|---|---:|---|
| Existing legacy share rows | 3 | information |
| Active legacy probe candidates | 3 | information |
| Owner-scoped ambiguous legacy matches | 0 | PASS |
| Owner-scoped unresolved legacy matches | 2 | **STOP** |
| Share rows without the existing legacy key | 0 | PASS |
| Marked `phase-38-production-canary` recordings | 0 | **STOP** |
| Orphan recording `event_id` values | 0 | PASS |
| Orphan participant `event_id` values | 0 | PASS |

The Phase 38 request, grant, audit, and outbox tables were absent, as expected
before applying migration 1. Corresponding Phase 38 policies, functions, and
triggers were also absent. Therefore post-migration orphan/duplicate/grant/RLS
checks were not applicable and were not represented as passing production
checks.

## Redacted Legacy Compatibility Probe

- Safe owner-scoped unique-match probe available: yes
- Token fingerprint: `sha256:92ddd37e5995`
- Before result class: HTTP 200, expected anonymous safe-subset response
- Forbidden protected fields observed: 0
- Full token, recipient, inviter, title, transcript, summary, IDs, and response
  payload: not recorded
- After result class: not run because the rollout stopped before mutation

## Canary and Mutation Record

The exact required canary lookup returned zero rows. The plan explicitly
forbids substituting a customer recording, so no UUID-native link was created
and no authenticated owner/team/coach/admin or request lifecycle probe was run
against production. This is the intended fail-closed behavior.

Commands deliberately not run:

- `supabase db push --linked`
- `supabase functions deploy share-call ...`
- `supabase functions deploy mcp-server ...`
- `supabase functions deploy public-recording ...`
- `supabase functions deploy recording-access ...`
- any Vercel command
- any `git push` or merge into `main`

## Evidence Privacy Review

This file contains aggregate counts, public deployment metadata, Git hashes,
truncated bundle/token fingerprints, and result classes only. It contains no
secret, full token, email address, customer title, transcript, summary, owner
identifier, recording identifier, or customer content.

---

## Plan 38-18 Rerun — 2026-09-20T00:36:06Z

The repaired rollout rerun stopped before production mutation. Every read-only
gate passed, but the reviewed canary tool cannot provision its exact graph
against the current pre-migration production schema: it unconditionally
inserts and later counts `call_share_access_log`, while that historical table
does not exist until authorized forward migration `20260919000009` runs. The
plan requires the exact six-user graph to exist before any migration and
forbids manually creating the table, reordering migrations, or using an
unreviewed canary. No provision command, database push, or function deployment
was run after this fail-closed finding.

### Immutable Source and Target Gate

| Guard | Observed | Result |
|---|---|---|
| Branch during production preflight | `v2.2-event-resolution` | PASS |
| Authorized source commit | `11095ce8b5420e151dd8e5d852363cf1607e02e1` | PASS; ancestor of HEAD |
| Preflight HEAD | `97c530c8c290024a909ab040faf04ee2985e7f86` | PASS |
| Authorized non-planning fingerprint | `13423c93d84e990e62a7d0a97bf1400916d4aa6f` | PASS |
| Recomputed non-planning fingerprint | `13423c93d84e990e62a7d0a97bf1400916d4aa6f` | PASS |
| Tracked, staged, and untracked non-planning paths | clean | PASS |
| Linked ref file | `vltmrnjsubfzrgrtdqey` | PASS |
| Supabase project listing | linked `callvault-ai` / `vltmrnjsubfzrgrtdqey`; TEST not linked | PASS |
| Production API host | exact ref-matching Supabase host | PASS |
| Committed-tree build | 4,839 modules transformed; exit 0; 7.11s | PASS |

No package install or lockfile change occurred.

### Release Boundary Before and After

Origin main before: cf63a53ea12ad9ed1628f43dfa41aa00257732b5
Origin main after: cf63a53ea12ad9ed1628f43dfa41aa00257732b5
Production frontend before: 6377574967|cf63a53ea12ad9ed1628f43dfa41aa00257732b5|https://app.callvaultai.com
Production frontend after: 6377574967|cf63a53ea12ad9ed1628f43dfa41aa00257732b5|https://app.callvaultai.com

No Git push, `main` merge, Vercel invocation, or frontend deployment occurred.

### Exact Migration Gate

`supabase migration list --linked` and `supabase db push --linked --dry-run`
showed exactly these nine pending migrations in order, with no earlier or
unexpected pending migration:

1. `20260919000001_phase38_access_policy_schema.sql`
2. `20260919000002_phase38_access_policy_rls_rpcs.sql`
3. `20260919000003_phase38_share_link_uuid_bridge.sql`
4. `20260919000004_phase38_copy_event_preservation.sql`
5. `20260919000005_phase38_authorization_review_fixes.sql`
6. `20260919000006_phase38_participant_evidence_recompute.sql`
7. `20260919000007_phase38_legacy_share_management.sql`
8. `20260919000008_phase38_notification_contracts.sql`
9. `20260919000009_phase38_restore_share_access_log.sql`

The reviewed checksums for the two remediation-sensitive files remained:

- `00003`: `sha256:620c3e7a7e1007762c3abad970a6bedcf9db18895488f90ae9d6afcae89c649c`
- `00009`: `sha256:e343ee69ed789f5f3df26f76a96558887f06eec49ef224fbee61a5118b052184`

Production migrations applied: none. All nine remain pending.

### Legacy and Integrity Preflight

| Invariant | Observed | Gate |
|---|---:|---|
| Unresolved legacy-only rows | 2 | PASS |
| Source absent | 1 | PASS |
| Source present only under another owner | 1 | PASS |
| Same-owner ambiguity | 0 | PASS |
| Unsafe cross-owner UUID assignments | 0 | PASS |
| Keyless share rows | 0 | PASS |
| Orphan recording events | 0 | PASS |
| Orphan participant events | 0 | PASS |

Authorized unresolved fingerprint before:
`sha256:bd0b96ecb0d08056ed8cb6fe2aca48968fb9f14cad3c31b071d1dec646a1d1bd`

Both unresolved tokens returned the same generic unavailable class before the
rollout: HTTP 404 / `CALL_NOT_FOUND`, with zero forbidden fields. The unique
resolvable legacy probe retained its prior redacted fingerprint
`sha256:92ddd37e5995` and returned HTTP 200 with zero forbidden fields. Raw
tokens, identifiers, response bodies, and customer content were held only in
process and were not written to evidence.

### Canary Compatibility STOP

The initial inventory correctly found zero existing production canary rows.
The reviewed tool's `provision` path was inspected before invoking it. Its
graph creation requires `call_share_access_log`, and both cleanup and residue
verification also query that table. Production does not have the table before
the nine-migration apply; Plan 17 introduced migration `00009` specifically to
restore it. Running provision would therefore create six auth users and a
partial graph, then fail on the absent table with a cleanup path that also
depends on the absent table.

Executing that known-failing mutation would violate the plan's guaranteed
cleanup contract. The safe disposition was STOP before provision and before
schema/function mutation. A final aggregate read confirmed:

Canary auth users after cleanup: 0
Canary graph rows after cleanup: 0

No canary manifest was created, and all temporary mode-0600 production API
material and probe scripts were deleted.

### Edge Function State

| Function | Before | After |
|---|---|---|
| `share-call` | ACTIVE; version 215; deployment `17b2e257-1836-4b5d-8cce-a35301670a6f`; JWT verification disabled | unchanged |
| `mcp-server` | ACTIVE; version 250; deployment `290f67b4-e4d4-43d9-9e0f-4725eed53324`; JWT verification disabled | unchanged |
| `public-recording` | not deployed | unchanged |
| `recording-access` | not deployed | unchanged |

Function deployments performed: none.

### Containment and Required Forward Fix

- **Failed assertion:** the reviewed tool cannot create the exact production
  canary before migration `00009` because its required access-log table is
  absent.
- **Containment:** no production migration, function deployment, customer-row
  write, canary user, Git push, `main` merge, or frontend deployment occurred.
- **Forward fix:** change the reviewed canary lifecycle so pre-migration
  provision and cleanup do not require a table that the rollout itself creates,
  prove the revised lifecycle against a pre-`00009` schema, issue a new source
  fingerprint-bound preproduction PASS, then rerun the production rollout.
- **Rollback state:** no rollback is needed; production server state is
  unchanged.

### Evidence Privacy Review

This rerun section contains only aggregate counts, public deployment metadata,
Git hashes, migration checksums, truncated token fingerprints, and result
classes. It contains no secret, full token, email, customer identifier, title,
transcript, summary, database URL, key, or response body.

PRODUCTION-SERVER-GATE: STOP
