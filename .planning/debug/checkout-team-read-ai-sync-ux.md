---
status: investigating
trigger: "Setup exposed several conversion and connection bugs: checkout payment failed with products invalid_type array error, team plan option did not work, skip credit card affordances are too prominent, setup team trial dropped user into organization, Read.ai copy button should be removed because signing key is not exposed, connected Read.ai still shows full connection setup, and sync page forces workspace selection again."
created: 2026-06-02T01:38:06Z
updated: 2026-06-02T01:38:06Z
---

# Debug Session: checkout-team-read-ai-sync-ux

## Symptoms

- Expected behavior: payment checkout should work; team plan should have a conversion-optimized path; no-credit-card escape should appear only as exit-intent fallback; connected Read.ai setup should collapse into a compact connected state; workspace should not require repeated selection when already inferable.
- Actual behavior: checkout fails; team trial path drops user into organization; Read.ai connected page still shows setup UI; sync flow asks for workspace again.
- Error messages: `Input validation failed: [ { "expected": "array", "code": "invalid_type", "path": [ "products" ], "message": "Invalid input" } ]`
- Timeline: observed during setup walkthrough after recent launch readiness/MCP work.
- Reproduction: run setup/onboarding, attempt checkout/team plan, connect Read.ai, return to sync/import page.

## Current Focus

- hypothesis: checkout creation sends a product shape incompatible with the current provider API, and setup UI state does not branch on connected source/workspace defaults.
- test: inspect checkout API payload construction, plan selection controls, Read.ai setup copy/signing-key UI, connected state rendering, and workspace selection logic.
- expecting: one or more code paths still use generic/free-trial-first UX and old source setup behavior despite Phase 05/06 intentions.
- next_action: gather initial evidence from routes, services, hooks, and onboarding components.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- 2026-06-02T01:45:00Z: Polar docs and SDK type check show checkout creation now requires `products: string[]`; existing function sent `productId`.
- 2026-06-02T01:45:00Z: Polar SDK `CheckoutCreate` accepts `externalCustomerId`, not `customerExternalId`.
- 2026-06-02T01:45:00Z: `SetupTrialUpsell` rendered visible no-credit-card copy and an inline skip button; exit-intent modal already existed.
- 2026-06-02T01:45:00Z: Team trial CTA navigated to `/organization?trial=team`, bypassing checkout.
- 2026-06-02T01:45:00Z: Read.ai adapter uses provider-generated signing key, but shared webhook form always rendered a signing-secret copy button.
- 2026-06-02T01:45:00Z: `ConnectorImportWizard` rendered `ConnectorSetupCluster` even for connected sources; `ConnectorSetupCluster` always rendered future landing workspace selector.
- 2026-06-02T01:45:00Z: Workspace defaults existed in status/routing/default workspace data but were not consistently used to avoid repeated selection.

## Eliminated

## Resolution

- root_cause: Checkout payload was stale for the current Polar API; onboarding trial page over-promoted no-card escape and routed Team away from payment; connected connector setup did not collapse and workspace defaults were not applied aggressively enough.
- fix: Use Polar `products: [productId]` and `externalCustomerId`; make Pro/Team checkout primary; keep no-card continuation only in exit modal; hide Read.ai signing-key copy; auto-select default workspace; collapse connected import setup to a compact status summary.
- verification: Focused Vitest suites passed; `npm run type-check` passed; `deno check --node-modules-dir=auto supabase/functions/polar-checkout/index.ts` passed after SDK field fix; `npm run build` passed.
- files_changed: supabase/functions/polar-checkout/index.ts; src/pages/SetupTrialUpsell.tsx; connector setup/import components and tests.
