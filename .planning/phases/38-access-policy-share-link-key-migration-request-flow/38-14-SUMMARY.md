---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "14"
subsystem: access-workflows
tags: [react, notifications, deep-links, supabase, privacy]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "11"
    provides: Request, grant, discovery, and owner-management service contracts
  - phase: 38-access-policy-share-link-key-migration-request-flow
    plan: "13"
    provides: Controlled owner Recording Access panel and focused-request seam
provides:
  - Anonymous event-copy discovery and one-click request UI
  - Typed and legacy-compatible recording-access notification navigation
  - Auth-preserving call and request deep-link bridge with owner review focus
  - Additive future notification normalization on the TEST database
affects: [38-15, 38-16, notifications, call-detail, recording-access]

tech-stack:
  added: []
  patterns:
    - Server-authorized minimal discovery rows with opaque mutation targets kept out of the DOM
    - UUID-validated notification routes constructed by the client instead of trusting stored route text
    - Additive notification trigger normalizes future access payloads while the UI supports legacy rows

key-files:
  created:
    - src/components/call-detail/OtherRecordingCopies.tsx
    - src/components/notifications/notification-metadata.ts
    - src/pages/__tests__/CallDetailPage.access.test.tsx
    - supabase/migrations/20260919000008_phase38_notification_contracts.sql
  modified:
    - src/components/CallDetailDialog.tsx
    - src/components/call-detail/CallOverviewTab.tsx
    - src/components/notifications/NotificationBell.tsx
    - src/components/sharing/RecordingAccessPanel.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - src/pages/CallDetailPage.tsx
    - src/test/access-policy.integration.test.ts
    - e2e/phase38-access.spec.ts

key-decisions:
  - "Future access notifications are normalized by one additive BEFORE INSERT trigger; previously stored Phase 38 rows remain readable through a strict legacy guard."
  - "Notification navigation is constructed only from validated UUIDs and never trusts metadata.route."
  - "The accessRequest query remains present while review is open, is removed when the access panel closes, and is removed with callId when the call dialog closes."

patterns-established:
  - "Anonymous discovery renders only server-returned ordinals, neutral copy, and request state; opaque target IDs stay in React data only."
  - "Focused owner review moves keyboard focus once to a tab-focusable review heading after authorized management data resolves."

requirements-completed: [ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-09]

duration: 15min
completed: 2026-09-19
---

# Phase 38 Plan 14: Discovery, Notifications, and Deep Links Summary

**Eligible participants can request anonymous meeting copies in one click, while typed notifications and validated deep links carry owners to the correct authorized review state.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-19T21:29:40Z
- **Completed:** 2026-09-19T21:44:11Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added the anonymous “Other recordings from this meeting” surface with server-authorized visibility, neutral numbered rows, 44px mobile actions, row-scoped sending, sent, cooldown, retry, approval-disappearance, and revoked-reappearance behavior.
- Extended the existing notification bell with strict requested/approved/denied metadata guards, safe legacy compatibility, exact action labels, UUID-built routes, and separate dismiss behavior.
- Added an additive TEST-only migration that normalizes all future access notification payloads to stable source/kind identifiers, canonical recording/request UUIDs, approved copy, and singular `/call/:uuid` routes.
- Preserved `accessRequest` through the `/call/:uuid` bridge into `/transcripts`, opened the existing owner panel, focused the requested review heading after authorized data loaded, and removed only the consumed query state.
- Added a generic unavailable state for non-owner deep links without mounting the owner-only management surface.

## Task Commits

1. **Task 1 RED: Activate anonymous discovery contracts** - `c04a2e6c` (test)
2. **Task 1 GREEN: Add anonymous copy request surface** - `63509f9d` (feat)
3. **Task 2 RED: Activate access notification contracts** - `0ee0176a` (test)
4. **Task 2 GREEN: Add typed access notifications and TEST migration** - `953e7d9a` (feat)
5. **Task 3 RED: Add access deep-link contracts** - `b892915d` (test)
6. **Task 3 GREEN: Preserve focused access request deep links** - `f2161a4e` (feat)
7. **Task 3 hardening: Isolate metadata guards and generic non-owner state** - `77194179` (fix)

## Files Created/Modified

- `src/components/call-detail/OtherRecordingCopies.tsx` - Minimal anonymous discovery and one-click request rows.
- `src/components/call-detail/CallOverviewTab.tsx` - Attaches discovery at the end of Overview using the already-resolved event UUID.
- `src/components/notifications/NotificationBell.tsx` - Renders access actions and navigates with client-built canonical routes.
- `src/components/notifications/notification-metadata.ts` - Strict UUID and typed metadata guards.
- `src/pages/CallDetailPage.tsx` - Validates and preserves call/request UUIDs across the route bridge.
- `src/components/transcripts/TranscriptsTab.tsx` - Carries validated focus state into the open call and clears it safely.
- `src/components/CallDetailDialog.tsx` - Controls owner panel opening and generic non-owner handling.
- `src/components/sharing/RecordingAccessPanel.tsx` - Expands and focuses the authorized pending request heading.
- `supabase/migrations/20260919000008_phase38_notification_contracts.sql` - Future notification normalization trigger.
- Focused component, route, integration, and browser contract tests - Active proof with no expected-failure placeholders.

## Decisions Made

- Used a trigger for the future notification contract so every existing request/approve/deny RPC receives the same payload correction without rewriting already-applied migrations or duplicating three large security-definer functions.
- Kept old stored notifications inert unless their database notification type and UUID fields form a recognized legacy Phase 38 shape.
- Kept request UUIDs out of anonymous discovery markup. Owner review uses the request UUID only in the intentional authenticated deep-link URL and authorized query input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added an explicit non-owner deep-link unavailable state**
- **Found during:** Task 3 authorization review
- **Issue:** The owner-only ACCESS control correctly stayed hidden for non-owners, but that left a valid request deep link without the UI specification's generic unavailable response.
- **Fix:** Render the exact generic unavailable message in the call dialog for a focused request when the current user is not the recording owner, without mounting owner management queries.
- **Files modified:** `src/components/CallDetailDialog.tsx`
- **Committed in:** `77194179`

---

**Total deviations:** 1 auto-fixed missing critical behavior.
**Impact on plan:** Completes the approved default-deny behavior without adding a new data path.

## TEST Database Evidence

- Explicit link guard confirmed dedicated TEST ref `swjzxiddcrtaqixsfaac` and rejected production ref `vltmrnjsubfzrgrtdqey` before applying schema work.
- Migration `20260919000008_phase38_notification_contracts.sql` applied to TEST only.
- TEST migration history confirmed local and remote `20260919000001` through `20260919000008` match.
- Real TEST database suite: **89/89 tests passed**, including request, approve, deny, cooldown, access matrix, and normalized notification payload assertions.
- CLI link restored to production ref after TEST work; tracked `supabase/.temp` files are clean.
- Production migration history still shows `20260919000001` through `20260919000008` as local-only/pending. No production database or frontend change occurred.

## Verification

- Focused discovery, notification, access-panel, route-bridge, header, Share dialog, Shared With Me, sharing-service, and Phase 38 migration suites: **9 files, 65 tests passed**.
- Real TEST database access-policy suite, single worker: **1 file, 89 tests passed**.
- Focused ESLint: **0 errors**; one pre-existing Fast Refresh warning remains for the reporter metadata export in `NotificationBell.tsx`.
- `npm run type-check`: **passed**, zero new errors; repository baseline remains 299/299.
- `npm run build` against the committed tree: **passed**, 4,839 modules transformed; existing chunk-size, dynamic/static import, and Browserslist-age warnings only.
- Acceptance scan: no `it.fails` markers or self-referential placeholder assertions remain in the activated discovery and notification suites.
- Package and lockfiles are unchanged.

## Browser Verification Limitation

The isolated worktree has no authenticated CallVault browser session and none of the required `PHASE38_*` browser fixture IDs are configured. The Playwright contract now asserts the final `/transcripts?callId=:recordingUuid&accessRequest=:requestUuid` route, but authenticated desktop/mobile screenshot and DOM/network proof remain for Plan 38-15 as planned.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: notification-normalization-trigger | `supabase/migrations/20260919000008_phase38_notification_contracts.sql` | Adds a security-definer trigger at the notification write boundary; execution is revoked from anon/authenticated and tested on the dedicated TEST database. |
| threat_flag: authenticated-request-deep-link | `src/pages/CallDetailPage.tsx` | Carries validated request UUID state into the owner review flow; owner-authorized management queries remain the data boundary. |

## User Setup Required

None.

## Next Phase Readiness

- Plan 38-15 can run the full integrated verification, authenticated desktop/mobile screenshots, network/DOM disclosure checks, and final phase evidence.
- Plan 38-16 remains the only authorized production Supabase rollout step. Production frontend deployment remains outside this plan.

## Self-Check: PASSED

- All 16 implementation, migration, test, and summary artifacts exist.
- All seven task commits exist in repository history.
- TEST migration history, production-unchanged evidence, focused tests, real database tests, lint, type check, build, link restoration, package/lockfile check, and clean-worktree check passed.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
