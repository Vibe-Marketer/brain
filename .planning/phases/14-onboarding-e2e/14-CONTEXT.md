# Phase 14: Onboarding E2E - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify and fix the existing onboarding wizard (OnboardingModal.tsx) so a brand-new user can sign up, complete the wizard, connect at least one call source, and land in a correctly-rendered default workspace. The wizard exists with 4 steps (Welcome, Connect Source, How It Works, All Set). This phase is gap-fixing and E2E verification of existing code.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — E2E verification and gap-fix phase. Key existing assets:
- `src/components/onboarding/OnboardingModal.tsx` — 4-step wizard (Welcome → Connect Source → How It Works → All Set)
- `src/hooks/useOnboarding.ts` — Manages onboarding state, marks completion in user_profiles
- `src/hooks/useSetupWizard.ts` — Setup wizard hook
- `src/components/ProtectedRoute.tsx` — Route guard that should redirect new users to onboarding
- Sign-up flows (email/password, Google OAuth, magic link) are Supabase Auth built-in
- Connect flows for Fathom/Zoom wired in Phase 12; YouTube always available

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/onboarding/OnboardingModal.tsx` — Complete 4-step wizard
- `src/hooks/useOnboarding.ts` — Onboarding state management
- `src/hooks/useSetupWizard.ts` — Setup wizard state
- `src/components/ProtectedRoute.tsx` — Auth + onboarding route guard
- Supabase Auth for sign-up (email, Google, magic link)

### Integration Points
- ProtectedRoute needs to check onboarding_completed and redirect to wizard
- OnboardingModal Step 1 needs working connect buttons for Fathom/Zoom/YouTube
- After wizard completion, user should land in default workspace with 4-pane layout
- Auth callback page handles OAuth redirects

</code_context>

<specifics>
## Specific Ideas

No specific requirements — verification and gap-fix phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 14-onboarding-e2e*
*Context gathered: 2026-03-30 via infrastructure skip*
