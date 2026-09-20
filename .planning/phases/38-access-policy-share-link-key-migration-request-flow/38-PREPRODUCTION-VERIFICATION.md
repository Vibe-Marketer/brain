---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "17"
checked_at: 2026-09-20T00:55:59Z
branch: v2.2-event-resolution
test_ref: swjzxiddcrtaqixsfaac
status: pass
---

# Phase 38 Preproduction Verification

Verified application source commit: 6808a4549e0e0fc0f3d7661b3596089c4aac601d
Verified application source fingerprint: b1b3db531c980ee01b44d2365084e2797e416522
Authorized Phase 38 migrations: 20260919000001..20260919000009
Authorized unresolved legacy count: 2
Authorized unresolved legacy fingerprint: sha256:bd0b96ecb0d08056ed8cb6fe2aca48968fb9f14cad3c31b071d1dec646a1d1bd

## Immutable Source and Target Gate

| Guard | Observed | Result |
|---|---|---|
| Branch | `v2.2-event-resolution` | PASS |
| Application source commit | `6808a4549e0e0fc0f3d7661b3596089c4aac601d` | PASS |
| Non-planning tree fingerprint | `b1b3db531c980ee01b44d2365084e2797e416522` | PASS |
| Tracked/staged/untracked non-planning paths | clean | PASS |
| TEST project ref | `swjzxiddcrtaqixsfaac` | PASS |
| Production ref rejected by TEST guards | `vltmrnjsubfzrgrtdqey` | PASS |
| Package or lockfile change | none | PASS |

The fingerprint was computed from the final committed non-planning tree after
the last source commit and before these planning-only evidence updates:
`git ls-tree -r --full-tree HEAD | sed '/\t\.planning\//d' | git hash-object --stdin`.

## Final Automated Gates

Every result below was produced after final source commit `6808a454`.

| Gate | Command | Final result |
|---|---|---|
| Focused Phase 38 | `SUPABASE_TEST_DB_URL=<guarded TEST URL> VITEST_INTEGRATION_OK=true npx vitest run <21 Phase 38 files> --maxWorkers=1 --reporter=verbose` | 21 files passed; 225 tests passed; 0 failed; 0 skipped; exit 0; 84.24s |
| Complete real-DB integration | `SUPABASE_TEST_DB_URL=<guarded TEST URL> npm run test:integration` | 33 files passed, 1 known credential-gated file skipped; 251 tests passed, 15 skipped; exit 0; 173.78s |
| Complete unit suite | `npm test` | 281 files passed, 1 pre-existing file skipped; 2,486 tests passed, 45 skipped; exit 0; 25.70s |
| Type check | `npm run type-check` | 0 new errors; recorded baseline 299/299; exit 0 |
| Lint | `npm run lint` | 0 errors; 129 existing warnings; exit 0 |
| Committed-tree build | `npm run build` | 4,839 modules transformed; built in 7.88s; exit 0 |
| Chromium, axe, privacy | `npx playwright test e2e/phase38-access.spec.ts --project=chromium --workers=1 --reporter=line,html --timeout=90000 --retries=0` | 18 tests passed; 0 failed; 0 skipped; exit 0; 39.0s |

The complete integration runner's only skipped file is the pre-existing
15-test `save-pasted-transcript` live-provider credential guard. The unit
suite's skipped file is the pre-existing 8-test `useBulkApplyRules` suite. No
Phase 38 focused or browser test was skipped.

## Browser, Accessibility, and Privacy Evidence

The deterministic TEST-only helper seeded isolated owner, confirmed
participant, unrelated user, public, provider, and 49/50 threshold states.
Vite was explicitly bound to the TEST URL and TEST publishable key with
`VITE_INTEGRATION_TEST_TARGET=true`. The auth setup used the synthetic owner's
manifest credentials without printing them. Final cleanup removed the fixture
and its local manifest.

Named evidence:

- `test-results/phase38-evidence/settings-defaults.png`
- `test-results/phase38-evidence/access-desktop.png`
- `test-results/phase38-evidence/owner-review.png`
- `test-results/phase38-evidence/anonymous-copies.png`
- `test-results/phase38-evidence/access-mobile.png`
- `test-results/phase38-evidence/public-page.png`

Axe found no serious or critical violations in the scanned Phase 38 surfaces.
Intercepted discovery/public payloads and rendered DOM contained only approved
opaque endpoint identifiers and no protected owner, provider, title, summary,
transcript, source, or organization/workspace fields.

## TEST Database and Migration Evidence

TEST now contains the exact ordered Phase 38 sequence
`20260919000001` through `20260919000009`. Only 00009 was applied during Plan
17. Read-only catalog inspection proved the restored access log exists with a
nullable accessor, two foreign keys, four indexes including its primary key,
RLS, one owner-read policy, revoked browser writes, service-role insert access,
and table/accessor comments.

The transactional migration replay proved:

- modified 00003 completes when the historical log table is absent;
- the guarded comment is a semantic no-op when it exists;
- 00009 repairs the absent shape and replays idempotently on the existing
  shape;
- anonymous service-role logging works, owners read only their link logs, and
  anonymous/authenticated clients cannot forge rows.

Final integrity counts are all zero: keyless shares, orphan UUID shares,
orphan requests, orphan grants, duplicate pending requests, duplicate active
grants, orphan recording events, and orphan participant events.

## Corrected Legacy and Canary Gates

The exact six-user TEST canary completed
`provision -> verify -> cleanup -> verify-zero-residue`: six users and its
isolated graph were present during verification; zero users and zero graph rows
remained after cleanup.

The canary adapter now treats only the expected missing-table errors for
`call_share_access_log` (`42P01` or `PGRST205` naming that exact table) as
zero/not-applicable before pending migration 00009. Provision, residue
verification, and exact targeted cleanup therefore complete against the
pre-00009 production shape. Permission failures, missing unrelated tables, and
all other errors still stop the run. After 00009, the same tests prove the
access-log row is inserted, counted, and removed normally.

The final production inventory was read-only and redacted. It authorized the
unchanged baseline of exactly two unresolved legacy rows: one whose source is
absent and one whose source exists only under another owner. Same-owner
ambiguity, unsafe cross-owner UUID assignments, and keyless share rows were all
zero. The stable fingerprint matched the value at the top of this document.

## Requirements and Decisions

The final focused, integration, RLS, browser, catalog, and static gates re-prove
D-01 through D-22, ACCESS-01 through ACCESS-09, and EVT-06 on this exact source
tree. Existing UUID and legacy token behavior, team/coach/admin access paths,
privacy-safe discovery, request lifecycle, provider/49-50 suppression, and
event-preserving copy flows all passed.

Static scans found no Phase 38 `it.fails`/`test.fails`, no unconditional Phase
38 skip, no recording-ID number coercion in the Phase 38 sharing/access paths,
and no direct Supabase data calls in the changed UI surfaces. MCP sharing still
returns markdown through `content[].text`.

## Production Boundary

This PASS authorizes a later deliberate production rollout only while the
source fingerprint, migration set, and two-row unresolved fingerprint remain
exactly equal. Plan 17 did not apply a production migration, provision a
production canary, deploy an Edge Function, push Git, merge to `main`, or deploy
the frontend.

PRODUCTION-GATE: PASS
