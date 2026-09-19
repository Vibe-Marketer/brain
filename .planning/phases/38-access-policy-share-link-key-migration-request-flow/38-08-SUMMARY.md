---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "08"
subsystem: api
tags: [supabase-edge-functions, react, tanstack-query, public-recordings, privacy]

requires:
  - phase: 38-access-policy-share-link-key-migration-request-flow
    provides: Phase 38 access policy schema, RLS/RPC contracts, and dedicated test fixtures from Plans 01-06
provides:
  - Anonymous Edge read boundary for explicitly Public recordings
  - Five-field public response allowlist with generic fail-closed denials
  - Typed service, UUID-scoped query hook, public page, and unauthenticated route
  - Dedicated-test deployment and live six-policy response evidence
affects: [38-09, 38-10, 38-16, public-recording-links]

tech-stack:
  added: []
  patterns:
    - Service-role Edge lookup constrained by an affirmative public policy predicate
    - Public browser data flows through pure service and TanStack Query hook layers
    - Anonymous content responses are reconstructed from an explicit field allowlist

key-files:
  created:
    - supabase/functions/public-recording/index.ts
    - src/types/public-recording.ts
    - src/services/public-recording.service.ts
    - src/hooks/usePublicRecording.ts
    - src/pages/PublicRecordingView.tsx
    - .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-TEST-PUBLIC-RECORDING-EVIDENCE.md
  modified:
    - supabase/config.toml
    - supabase/functions/public-recording/__tests__/public-recording.integration.test.ts
    - src/App.tsx
    - src/lib/query-config.ts
    - src/pages/__tests__/PublicRecordingView.test.tsx

key-decisions:
  - "Public content is served only through a service-role Edge boundary with access_level=public; anon receives no raw recordings SELECT grant."
  - "Missing, malformed, and all five non-Public access levels return the same 404 code and body."
  - "The browser cache key contains only the normalized recording UUID; endpoint responses are strictly parsed and rebuilt before rendering."

patterns-established:
  - "Public Edge allowlist: select the predicate field server-side, then construct a fresh response containing only approved content fields."
  - "Generic denial: invalid UUID, missing row, database lookup failure, and non-Public policy fail closed without exposing row existence."

requirements-completed: [ACCESS-01, ACCESS-03]

duration: 19 min
completed: 2026-09-19
---

# Phase 38 Plan 08: Affirmative Public Recording Read Path Summary

**A service-role Edge boundary now serves exactly five fields for explicitly Public recordings, with a typed anonymous React route and indistinguishable denials for every other policy.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-19T18:12:41Z
- **Completed:** 2026-09-19T18:31:11Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `public-recording`, which validates one UUID, requires `access_level='public'`, and reconstructs a five-field response without exposing owner, provider, source, event, organization, workspace, summary, media, or participant data.
- Added a strict wire contract, pure fetch service, UUID-normalizing query hook, accessible public recording page, and unauthenticated `/public/:recordingId` route.
- Promoted prior expected-failure contracts to required tests and added malformed-ID and network-state page coverage.
- Deployed version 1 to the dedicated test project only. All seven focused live tests passed; the six-policy matrix proved only Public returns content, and raw anonymous table access returned zero rows.
- Confirmed production does not contain `public-recording` and restored the CLI link to production without deploying.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the allowlisted public-recording endpoint** — `de07d471` (RED), `fdba58df` (GREEN)
2. **Task 2: Wire the public route through service and hook layers** — `5bcffca6` (RED), `f871dcca` (GREEN)
3. **Task 3: Deploy to dedicated test and probe default deny** — `517c76e3` (evidence)

## Files Created/Modified

- `supabase/functions/public-recording/index.ts` — Anonymous UUID endpoint with affirmative Public predicate and five-field output.
- `supabase/config.toml` — Explicit anonymous gateway configuration for the internally gated endpoint.
- `supabase/functions/public-recording/__tests__/public-recording.integration.test.ts` — Required live six-policy and exact-key contract.
- `src/types/public-recording.ts` — Strict payload and discriminated service result types.
- `src/services/public-recording.service.ts` — UUID validation, encoded Edge request, strict response parsing, and response reconstruction.
- `src/hooks/usePublicRecording.ts` — TanStack Query wrapper keyed by normalized UUID.
- `src/pages/PublicRecordingView.tsx` — Accessible loading, content, unavailable, and network states.
- `src/App.tsx` — Public route registered outside `ProtectedRoute`.
- `src/lib/query-config.ts` — Canonical public-recording cache key factory.
- `src/pages/__tests__/PublicRecordingView.test.tsx` — Public content, denial, malformed, and network rendering coverage.
- `38-TEST-PUBLIC-RECORDING-EVIDENCE.md` — Deployment identity, SHAs, live response matrix, raw-table denial, and production non-deployment proof.

## Decisions Made

- Used the existing service role only inside the Edge Function. The browser receives no elevated credential and no raw table permission.
- Returned the same 404 body for malformed UUIDs, missing rows, non-Public rows, and fail-closed lookup failures so callers cannot infer recording existence.
- Parsed the Edge response with a strict Zod schema and rebuilt the frontend payload, preventing an accidental backend field addition from flowing into the page.
- Disabled query retries for this anonymous read so a generic unavailable/error state does not generate repeated content probes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered the anonymous gateway and canonical cache key**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan's primary file list omitted the function's `verify_jwt=false` deployment contract and the shared query-key factory change required by its own anonymous-access and stable-UUID criteria.
- **Fix:** Added `public-recording` to `supabase/config.toml` and added a UUID-only key factory to `src/lib/query-config.ts`.
- **Files modified:** `supabase/config.toml`, `src/lib/query-config.ts`
- **Verification:** Dedicated deployment reports `verify_jwt=false`; page data flows through `queryKeys.publicRecording.detail(normalizedId)`.
- **Committed in:** `fdba58df`, `f871dcca`

**2. [Rule 2 - Missing Critical] Added explicit malformed and network page coverage**
- **Found during:** Task 2
- **Issue:** The prewritten page contract covered success and generic copy but did not separately prove the plan's malformed-ID and accessible network-error criteria.
- **Fix:** Added malformed-route coverage and a network state asserted through `role="alert"` while retaining the same non-disclosing text.
- **Files modified:** `src/pages/__tests__/PublicRecordingView.test.tsx`
- **Verification:** 5/5 focused page tests pass.
- **Committed in:** `f871dcca`

---

**Total deviations:** 2 auto-fixed (2 missing critical coverage/configuration items).  
**Impact on plan:** Both changes directly enforce the planned anonymous-access and privacy contracts without broadening product behavior.

## Issues Encountered

- The focused live public-recording suite passed 7/7, but the first repository-wide integration run overlapped other parallel Phase 38 executors using the same dedicated Supabase project. Shared fixture cleanup removed in-flight synthetic users/share rows and the combined auth volume hit a test-project rate limit. The public-recording suite still passed inside that run. The root orchestrator acknowledged the collision and will run one final serial suite after merging the parallel wave.
- Deno and Supabase commands refreshed generated lock/temp metadata. Those unrelated generated changes were reverted before commits.
- Local browser screenshot capture timed out in the Chrome bridge; component tests, TypeScript, ESLint, and a full Vite production build independently verified the route and render states.

## Verification

- `deno check supabase/functions/public-recording/index.ts` — passed.
- Focused live public-recording integration — **7 passed**.
- Live anonymous matrix — Public 200 with exactly five keys; five non-Public policies and missing UUID all returned the identical generic 404.
- Raw anonymous `recordings` SELECT — zero rows.
- PublicRecordingView — **5 passed**.
- Type check — **0 new errors**, baseline 319/321.
- Focused ESLint — **0 errors**.
- Vite production build — **passed**, 4,828 modules transformed.
- Production function inventory — `public-recording` absent.
- Final CLI ref — `vltmrnjsubfzrgrtdqey`.

## Known Stubs

None. The “not available” strings are intentional user-facing privacy states, not placeholders.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Public recording links can now target `/public/:recordingId` once owner-facing policy UI exposes that action.
- The root orchestrator should run the complete integration command once after merging the parallel worktrees, when no executor is mutating shared TEST fixtures.
- Production remains unchanged; any production Edge deployment stays under the milestone's explicit release controls.

## Self-Check: PASSED

- All six created artifacts and five modified artifacts exist.
- All five task commits exist in git history.
- Focused endpoint, page, type, lint, build, deployment, live matrix, raw-table-denial, production-absence, and final-relink claims were verified in this run.

---
*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Completed: 2026-09-19*
