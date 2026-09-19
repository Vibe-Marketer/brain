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
