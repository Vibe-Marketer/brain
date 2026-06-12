---
phase: 06-launch-ux-support-rls-hygiene
plan: 04
subsystem: ui
tags: [billing, paywall, mcp, polar, onboarding]
requires:
  - phase: 06-launch-ux-support-rls-hygiene
    provides: onboarding/support/empty-state launch UX foundation from prior 06 plans
provides:
  - Inline paywall dialog and locked-action wrapper for paid feature gates
  - MCP free-tier locked affordances that upgrade in place
  - Route-preserving successPath coverage for paywall-triggered checkout
affects: [billing, settings, mcp, subscription-gates]
tech-stack:
  added: []
  patterns:
    - locked in-place action opens paywall dialog instead of forced redirect
    - checkout successPath derived from current route plus stable action marker
key-files:
  created:
    - src/components/billing/PaywallDialog.tsx
    - src/components/billing/LockedFeatureButton.tsx
    - src/components/billing/__tests__/paywall-gate.test.tsx
  modified:
    - src/components/settings/MCPTab.tsx
    - src/components/settings/BillingTab.tsx
    - src/hooks/useRequirePaidPlan.ts
key-decisions:
  - "MCP free-tier gating now uses in-place locked actions so users can upgrade without leaving context."
  - "useRequirePaidPlan keeps redirect compatibility while exposing inline-gate metadata for non-redirect surfaces."
patterns-established:
  - "Use LockedFeatureButton + PaywallDialog for visible paid affordances instead of hiding actions."
  - "Pass route-preserving successPath to UpgradeButton for checkout return continuity."
requirements-completed: [ONB-03]
duration: 8min
completed: 2026-06-01
---

# Phase 06 Plan 04: Launch UX Support RLS Hygiene Summary

**Paid feature gates now render inline locked affordances with route-preserving checkout context instead of redirect-only billing detours.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-01T06:34:00Z
- **Completed:** 2026-06-01T06:42:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added reusable billing paywall primitives (`PaywallDialog`, `LockedFeatureButton`) with required copy and CTA contract.
- Replaced MCP free-tier upgrade handling with explicit locked action affordances that open paywalls in place.
- Added focused billing component test coverage proving `successPath` keeps route + action marker when opening checkout from a locked control.

## Task Commits

1. **Task 1: Add reusable paywall dialog and locked action wrapper** - `32289d42` (feat)
2. **Task 2: Apply the gate to visible Pro/Team launch affordances** - `c553a7c6` (feat)
3. **Task 3: Test successPath preservation for paywall gates** - `60f1820b` (test)

## Files Created/Modified
- `src/components/billing/PaywallDialog.tsx` - Reusable paywall dialog with required title/body/CTA structure.
- `src/components/billing/LockedFeatureButton.tsx` - In-place locked action wrapper with route/action-aware successPath handling.
- `src/components/settings/MCPTab.tsx` - MCP free-tier locked affordances for connect/create actions.
- `src/components/settings/BillingTab.tsx` - Billing upgrade button now pins checkout return to Billing tab.
- `src/hooks/useRequirePaidPlan.ts` - Adds inline-gate metadata while preserving legacy redirect fields.
- `src/components/billing/__tests__/paywall-gate.test.tsx` - Verifies paywall title and successPath propagation.

## Decisions Made
- Keep Billing tab upgrade actions on `UpgradeButton` while passing explicit `successPath` for return continuity.
- Preserve `useRequirePaidPlan` backward-compatible fields (`isRequired`, `isLoading`, `redirectUrl`) and add additive inline-gate context.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-04 is complete and verified; paid gate behavior is now inline and test-covered.
- Ready for the next remaining Phase 06 plan.

## Verification

- `rg -n "Upgrade to keep going|Not now|RiLockLine|successPath" src/components/billing/PaywallDialog.tsx src/components/billing/LockedFeatureButton.tsx` ✅
- `rg -n "LockedFeatureButton|PaywallDialog|useRequirePaidPlan|UpgradeButton" src/components/settings src/hooks/useRequirePaidPlan.ts && npm run build` ✅
- `npm run test -- --run src/components/billing/__tests__/paywall-gate.test.tsx` ✅
- `npm run test -- --run src/components/billing/__tests__/paywall-gate.test.tsx && npm run build` ✅

## Self-Check: PASSED

