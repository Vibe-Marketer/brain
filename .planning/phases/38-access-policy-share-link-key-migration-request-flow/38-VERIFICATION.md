---
phase: 38-access-policy-share-link-key-migration-request-flow
verified: 2026-09-20T02:41:17Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 38: Access Policy, Share-Link Key Migration, Request Flow Verification Report

**Phase Goal:** Per-recording content access with privacy-safe, participant-qualified copy discovery and a request/approve flow — with existing sharing untouched.
**Verified:** 2026-09-20T02:41:17Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Access policy is stored per recording across all six levels; content remains default-deny and event membership does not create content access. | ✓ VERIFIED | `20260919000001_phase38_access_policy_schema.sql` adds the six-value recording policy and private account default, with a before-insert snapshot trigger. `20260919000002_phase38_access_policy_rls_rpcs.sql` restricts owner mutations and separates confirmed participation from the complete recording-read authorization helper. `20260919000005_phase38_authorization_review_fixes.sql` includes owner, organization admin, workspace, UUID/legacy share, active grant, and policy access. The production live matrix passed private denial plus owner/admin/workspace/org/attendee/invitee paths. |
| 2 | A confirmed participant sees only an anonymous count/list of inaccessible copies, and discovery is suppressed for authoritative webinars and events with 50 or more confirmed participants. | ✓ VERIFIED | `list_discoverable_recording_copies` returns ordinal, opaque recording UUID, and request state only; the requester-safe TypeScript contract excludes owner/provider/title/content fields. Server functions require verified confirmed evidence, suppress any authoritative webinar signal, and enforce `< 50`. Production passed privacy-safe discovery and the exact 49-allowed/50-denied boundary. |
| 3 | A participant can request one copy; the owner is notified and can approve or deny; approved access is revocable and all decisions are logged. | ✓ VERIFIED | The lifecycle migrations create requests, grants, audit, notifications, and outbox records in server-authorized RPCs. `recording-access/index.ts` authenticates by shared helper, accepts only `request_id`, reads trusted server data, and uses an idempotent outbox. Hooks wire request/approve/deny/revoke to the service and cache invalidation. Production passed request/retry, notification/outbox, approve/grant/revoke, deny/cooldown. |
| 4 | Share links use the canonical recording UUID without breaking legacy token/team/coach behavior, and all current copy/routing functions preserve `event_id`. | ✓ VERIFIED | Migration `00003` adds nullable `call_share_links.recording_id` with an owner-scoped deterministic backfill while retaining `call_recording_id`; `00007` manages unresolved legacy links without arbitrary attachment. Share-call and MCP use UUID-first, legacy-fallback paths. Migration `00004` inserts `v_source.event_id` in all three current copy/routing signatures. Production passed UUID create/resolve/revoke, legacy token/recipient behavior, existing access paths, copy preservation, and MCP markdown. |
| 5 | The recording settings UI explains that policy applies only to this copy and cannot restrict other attendees' copies. | ✓ VERIFIED | `RecordingAccessPanel.tsx` renders the exact persistent notice: “This controls your recording only. Other attendees control their own copies.” It also preserves the team/coach/share helper in loading, error, and loaded states. Focused component tests passed all three states; the committed browser suite passed desktop and mobile flows. |

**Score:** 5/5 truths verified

## Production Completion Gates

| Gate | Independent evidence | Status |
|---|---|---|
| Final production gate | `38-PRODUCTION-DEPLOYMENT-EVIDENCE.md` has an authoritative final section ending `PRODUCTION-SERVER-GATE: PASS`; earlier STOP records are retained as attempt history. | ✓ PASS |
| Production migrations | Current read-only `supabase migration list --linked` shows local and remote entries for exactly `20260919000001` through `20260919000009`. | ✓ PASS |
| Production functions | Current read-only `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` shows `share-call` v218, `mcp-server` v251, `public-recording` v1, and `recording-access` v1, all ACTIVE. | ✓ PASS |
| Canary cleanup | Final evidence records 0 official and independent marked Auth users, recordings, organizations, local manifests, and 0 exact graph rows. | ✓ PASS |
| Legacy preservation | Final inventory remains exactly 2 unresolved legacy rows with fingerprint `sha256:bd0b96ecb0d08056ed8cb6fe2aca48968fb9f14cad3c31b071d1dec646a1d1bd`: one source absent and one cross-owner-only; ambiguity, unsafe assignments, and keyless rows are 0. Both stay generically unavailable. | ✓ PASS |
| Frontend/release boundary | Current `git ls-remote` shows `origin/main` at `cf63a53e`; GitHub's newest Production deployment remains `6377574967` at the same SHA; `https://app.callvaultai.com` returns HTTP 200. | ✓ PASS |
| Plan 38-18 completion | `38-18-SUMMARY.md` records 3/3 tasks, 9/9 migrations, 4/4 approved functions, and 10/10 requirements. Commit `92b0a7e0` contains the final production evidence and summary. | ✓ PASS |

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/20260919000001..00009` | Additive policy, lifecycle, UUID bridge, copy preservation, authorization corrections, notification contracts, and access-log repair | ✓ VERIFIED | All nine files exist and are substantive (32–931 lines). The static migration gate passed 19/19 in the final preproduction run and 19/19 source assertions are recorded for rollout; the verifier's focused migration suite passed again. |
| `src/services/access-policy.service.ts` + `src/hooks/useAccessPolicy.ts` | Pure service and TanStack owner policy operations | ✓ VERIFIED | Hook imports and calls the service, handles optimistic rollback, and invalidates call-list caches in mutation settlement. |
| `src/services/recording-access.service.ts` + `src/hooks/useRecordingAccess.ts` | Privacy-safe discovery and request lifecycle | ✓ VERIFIED | Service maps minimized RPC payloads; hook wires query/request/approve/deny/revoke flows and invalidates lifecycle, call, and notification caches. |
| `supabase/functions/recording-access/index.ts` | Authenticated, trusted, idempotent owner notification delivery | ✓ VERIFIED | Uses shared authentication, strict request-ID schema, trusted server lookup, HTML escaping, claim/retry states, and an idempotency key. Active in production at v1. |
| `supabase/functions/public-recording/index.ts` | Explicit Public-only allowlisted anonymous response | ✓ VERIFIED | Queries by canonical UUID plus `access_level=public`, returns only the approved payload, and uses one generic 404 for malformed, private, missing, or failed lookups. Active in production at v1. |
| `supabase/functions/share-call/index.ts` and MCP share tools | UUID-native writes with safe legacy fallback and preserved markdown output | ✓ VERIFIED | Canonical UUID resolution is first, legacy resolution is owner-scoped, expiration/revocation paths fail safely, anonymous logging uses a null accessor, and MCP links remain `/s/<token>` markdown. Active production versions match the release evidence. |
| `AccessLevelPicker`, `PrivacyAccessSettings`, `RecordingAccessPanel`, `OtherRecordingCopies` | Accessible default/per-recording policy and anonymous request UI | ✓ VERIFIED | Components are substantive and connected through hooks. Browser evidence covers desktop/mobile, focus, Public confirmation, copy-only notice, anonymous list, request states, axe, and privacy scans. |
| `scripts/phase38-production-canary.ts` | Fail-closed six-user manifest-bound canary | ✓ VERIFIED | Requires explicit production confirmation, computes the unresolved-row fingerprint, supports pre-migration shapes narrowly, targets exact manifest IDs for cleanup, and was used for the zero-residue production proof. |
| `38-PREPRODUCTION-VERIFICATION.md` | Fingerprint-bound source authorization | ✓ VERIFIED | Records final focused, full integration, unit, type, lint, build, browser, privacy, TEST migration, and canary PASS evidence with `PRODUCTION-GATE: PASS`. |
| `38-PRODUCTION-DEPLOYMENT-EVIDENCE.md` | Final production application and containment record | ✓ VERIFIED | Records exact migrations/functions, live behavior, integrity queries, legacy fingerprint, cleanup, and immutable frontend boundary. Final gate is PASS. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| New recording insert | Account default | `snapshot_recording_access_policy` before-insert trigger | ✓ WIRED | Trigger reads owner `user_settings.default_recording_access_level`, falls back to private, and snapshots origin `default`. |
| Event participation | Copy discovery | Server-side confirmation and event-size/type gates | ✓ WIRED | Discovery calls both `phase38_user_is_verified_confirmed_participant` and `phase38_event_allows_discovery`; inaccessible rows are numbered only after filtering. |
| Request action | Request, notification, audit, outbox | `request_recording_access` transaction then request-ID Edge handoff | ✓ WIRED | RPC persists first; service invokes Edge by the resulting request ID; delivery failure remains a saved request with pending delivery. |
| Owner decision | Grant/deny/revoke and UI caches | Hardened RPCs plus hook `onSettled` invalidation | ✓ WIRED | Source and focused tests show owner-only actions, optimistic rollback, conflict refetch, and call/lifecycle/notification invalidation. |
| Share UI/MCP/share-call | `call_share_links.recording_id` | Canonical UUID writes with legacy fallback only when UUID is absent | ✓ WIRED | Frontend uses `useSharing`; MCP create/list/revoke and Edge resolution operate on canonical UUIDs while retaining old-key compatibility. |
| Public route | Public Edge function | Page → hook → pure service → Edge allowlist | ✓ WIRED | `/public/:recordingId` renders `PublicRecordingView`, which uses `usePublicRecording`; service calls the active function. |
| Notification deep link | Owner access review | `/call/:uuid?accessRequest=:uuid` preservation | ✓ WIRED | Notification route, redirect preservation, controlled panel opening, request expansion, and focus are covered by unit and browser tests. |
| Copy/routing insert | Source event | `v_source.event_id` in all three latest function bodies | ✓ WIRED | Static source checks and production live copy probe both passed. |
| Plan 17 authorization | Plan 18 production result | Matching source fingerprint, migration set, legacy baseline, and final production gate | ✓ WIRED | Preproduction gate is PASS; production evidence proves exact nine-migration rollout, preserved fingerprint, cleanup, and unchanged frontend boundary. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `PrivacyAccessSettings` | `accountDefault.data.accessLevel` | `useAccountAccessDefault` → service → `get_user_access_default` RPC | Yes; production policy catalog and TEST/live matrix verified | ✓ FLOWING |
| `RecordingAccessPanel` | policy, pending requests, active grants | access-policy and recording-access hooks → owner RPCs | Yes; production request/grant matrix verified | ✓ FLOWING |
| `OtherRecordingCopies` | minimized copy rows | discovery hook → `list_discoverable_recording_copies` RPC | Yes; production anonymous discovery and 49/50 matrix verified | ✓ FLOWING |
| `PublicRecordingView` | allowlisted public payload | hook → service → `public-recording` Edge function → recordings lookup | Yes; production public/private endpoint matrix verified | ✓ FLOWING |
| Shared With Me | canonical recording rows | `useSharedWithMe` → `get_calls_shared_with_me_v3` | Yes; UUID and legacy compatibility tests/live probes verified | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Migration contracts, six-level settings, copy-only notice, anonymous discovery, hook invalidation, and public view | `npx vitest run <7 focused Phase 38 files> --reporter=verbose --maxWorkers=1` | 7 files, 56 tests passed, 0 failed, exit 0 in 3.01s | ✓ PASS |
| Production migration presence | `supabase migration list --linked` | All nine Phase 38 versions show Local=Remote | ✓ PASS |
| Production function presence | `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` | Exact approved four functions active at v218/v251/v1/v1 | ✓ PASS |
| Release boundary | `git ls-remote`, GitHub deployments API, frontend HTTP probe | `main` and deployment remain on `cf63a53e`; frontend HTTP 200 | ✓ PASS |

The verifier did not rerun the complete integration or browser suites because the final fingerprint-bound preproduction evidence already records one complete run after the final source commit: 235 focused tests, 251 real-DB integration tests, 2,488 unit tests, type/lint/build, and 18 Chromium tests all passed. The production matrix then exercised the deployed server behavior on a synthetic graph.

## Probe Execution

No conventional `scripts/*/tests/probe-*.sh` or phase-declared shell probe exists. The Plan 18 production canary is a guarded mutation tool and was not rerun during verification because the verifier was explicitly prohibited from creating new production mutations. Its completed live matrix and cleanup are recorded in `38-PRODUCTION-DEPLOYMENT-EVIDENCE.md`; current read-only migration/function/main/deployment checks independently match that record.

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| ACCESS-01 | 38-01/02/03/04/06/08/09/12/13/15–18 | ✓ SATISFIED | Six-level policy and private default exist on each recording; owner mutations and public endpoint are live; six-level TEST and production matrices pass. |
| ACCESS-02 | 38-01/02/03/04/06/11/14/15–18 | ✓ SATISFIED | Confirmed participation is verified server-side and yields existence/anonymous copy metadata independently of content policy. |
| ACCESS-03 | 38-01/02/04/06/08/09/11/14/15–18 | ✓ SATISFIED | Complete read helper and RLS preserve default denial; event membership alone is insufficient; private and unqualified live probes deny. |
| ACCESS-04 | 38-01/02/03/04/06/11/14/15–18 | ✓ SATISFIED | Requester-facing rows contain ordinal/opaque target/request state only; payload/DOM privacy scans and production discovery probe pass. |
| ACCESS-05 | 38-01/02/03/04/06/11/13/14/15–18 | ✓ SATISFIED | Request, owner notification, approve/deny, active grant, revoke, audit, cooldown, and retry are implemented and live-probed. |
| ACCESS-06 | 38-03/09/12/13/15–18 | ✓ SATISFIED | Persistent recording panel copy explicitly says this recording only and other attendees control their copies; component and browser gates pass. |
| ACCESS-07 | 38-01/03/05/06/07/10/15–18 | ✓ SATISFIED | UUID bridge is live, new paths use canonical UUID, legacy key remains, and unresolved rows are preserved safely. |
| ACCESS-08 | 38-01/02/03/05/06/07/10/13/15–18 | ✓ SATISFIED | Legacy tokens and owner/admin/workspace/team/coach/share paths remain additive and pass TEST plus production compatibility probes. |
| ACCESS-09 | 38-01/02/03/04/06/11/14/15–18 | ✓ SATISFIED | Authoritative webinar suppression, verified evidence rules, and exact 49/50 cutoff are enforced server-side and pass production probes. |
| EVT-06 | 38-01/02/05/06/15–18 | ✓ SATISFIED | All three current copy/routing definitions insert `v_source.event_id`; static, real-DB, and production live copy checks pass. |

No Phase 38 requirement is orphaned: all ten IDs in the roadmap appear in plan frontmatter. The central `REQUIREMENTS.md` checkbox/traceability update remains a transition bookkeeping action after this verification; the implementation evidence above satisfies each requirement.

## Review and Anti-Pattern Results

| Check | Result | Impact |
|---|---|---|
| Interim code review | 12 findings were filed (2 blockers, 3 high, 5 medium, 2 low); `38-INTERIM-REVIEW-FIXES.md` records 12 fixed, 0 skipped, 0 remaining. Later preproduction and production matrices exercised the corrected behaviors. | No remaining blocker |
| Debt markers | No `TBD`, `FIXME`, or `XXX` markers in Phase 38 changed code. | None |
| Warning markers/stubs | No `TODO`, `HACK`, `PLACEHOLDER`, “coming soon,” or “not yet implemented” markers in Phase 38 changed code. | None |
| Empty implementation scan | `OtherRecordingCopies` intentionally returns `null` when loading, unqualified, or no anonymous rows exist; the hook has already fetched data and tests verify each state. Service `return []` branches reject malformed payloads rather than supplying visible placeholder data. | Intentional, not a stub |
| Repository diff check | Only pre-existing Markdown hard-break trailing spaces are reported in historical planning/review documents; no source error was found. | Informational |

### Disconfirmation Pass

1. **Potential partial requirement:** A confirmed participant who also had an existing admin/workspace/share path was previously misclassified as needing a request. Corrective migration `00005`, combined-role real-DB tests, and the production access matrix now prove those users already have access and are not shown/requested as anonymous copies.
2. **Potential misleading test:** Static migration tests alone cannot prove deployed behavior. Current remote migration/function metadata and the final production synthetic matrix independently prove the code is deployed and working.
3. **Potential uncovered error path:** Successful anonymous share views originally bypassed access logging. The production canary caught it; commit `55dc3256` moved logging after valid content resolution, `e34d5524` covers positive/negative/JWT-forgery paths, and production `share-call` v218 passed the rerun.

## Human Verification Required

None. The visual, focus, accessibility, privacy, desktop/mobile, and live server behaviors in the phase contract were exercised by the 18-test Chromium/axe suite and the final six-user production matrix. No deferred `<human-check>` block exists in the Phase 38 plans.

## Gaps Summary

No goal-blocking gaps remain. The five roadmap success criteria and all ten mapped requirements are implemented, wired, tested, and live on the production Supabase server. The production frontend remains deliberately unchanged on `main`; that is the required release boundary for this milestone work.

---

_Verified: 2026-09-20T02:41:17Z_
_Verifier: the agent (gsd-verifier)_
