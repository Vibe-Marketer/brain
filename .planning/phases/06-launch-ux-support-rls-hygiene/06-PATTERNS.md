# Phase 06 - Pattern Map

**Generated:** 2026-06-01
**Purpose:** Concrete analog files and implementation seams for Phase 6 plans.

## First-Run Import and Video

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Trial completion -> import landing | `src/pages/SetupTrialUpsell.tsx` | `enterApp()` calls `completeOnboarding()` then navigates to `/import`; checkout already passes `successPath="/import?trial=checkout"`. |
| Connector-first onboarding | `src/pages/SetupWizard.tsx` | Persist setup state in localStorage, route OAuth callback back to `/setup?source=...&connected=true`, require a connected source before trial. |
| OAuth return selection | `src/pages/OAuthCallback.tsx`, `src/pages/ImportPage.tsx` | Append `source`, `connected`, `sourceId`, `email` params; `ImportPage` selects provider and handles connection success. |
| How It Works modal | `src/components/onboarding/HowItWorksModal.tsx` | Reusable Radix Dialog content; keep video modal close to this pattern. |

## Import Library and Sync-All

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Connector wizard | `src/components/connectors/ConnectorImportWizard.tsx` | Provider-specific call discovery/import surface; prefer extending this over adding a parallel import UI. |
| Sync tab orchestration | `src/hooks/useSyncTabOrchestration.ts` | Fetch provider calls through adapters, maintain selected rows, create jobs, invalidate query caches. |
| Available call adapter | `src/components/connectors/registry/types.ts`, `src/components/connectors/registry/adapters/fathom.ts` | Extend `AvailableCall` and Fathom mapping for all-time/default results and optional remote-update state. |

## Support Popout and Ticket

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Sidebar placement | `src/components/ui/sidebar-nav.tsx` | Bottom area currently holds separate `Take the tour` and `How it works`; replace with one Support trigger above Settings. |
| Existing tour | `src/lib/tour.ts` | Support action calls `startTour()`. |
| Existing explainer | `src/components/onboarding/HowItWorksModal.tsx` | Support action opens current modal. |
| Authenticated Resend function | `supabase/functions/send-org-invite/index.ts` | Use `authenticateRequest`, Zod body validation, CORS, HTML escaping, and Resend request shape. |

## Empty States

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Calls empty state | `src/components/transcript-library/EmptyStates.tsx` | Centered icon + heading/body + one primary CTA. Remove direct audio/video upload promise. |
| Import no-results state | `src/components/connectors/ConnectorImportWizard.tsx`, `src/components/sync/SyncEmptyState.tsx` | Keep action-focused copy and avoid blank panes. |
| Workspace/folder/contact empty states | `src/components/panes/WorkspaceSidebarPane.tsx`, `src/components/settings/WorkspaceManagement.tsx`, `src/components/contacts/ContactsTable.tsx` | Update only launch-blocking empty states; do not refactor all pane internals. |

## Billing Gates

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Checkout CTA | `src/components/billing/UpgradeButton.tsx` | Accepts `successPath`, calls `polar-checkout`, redirects to Polar. |
| Subscription gate | `src/hooks/useRequirePaidPlan.ts`, `src/hooks/useSubscription.ts` | Keep gating logic in hooks; add UI wrapper/dialog instead of raw redirects. |
| Checkout Edge Function | `supabase/functions/polar-checkout/index.ts` | Validates relative `successPath`; no new checkout backend should be needed. |

## RLS Regression

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Cross-org real DB test | `src/test/rls-regression.test.ts` | Service-role creates fixtures; anon JWT clients assert both orgs cannot read each other's rows. |
| Missing table schemas | `supabase/migrations/20260310160000_mcp_tokens.sql`, `20260306000000_personal_organization_and_home.sql`, `20260507083233_call_notes.sql`, `20260401140000_contact_folders.sql`, `20260228000002_create_import_sources.sql`, `20260228000003_create_import_routing_rules.sql` | Add fixture rows and table filters using final schema names. |

## Optional Fathom Resync

| Target | Existing Analog | Pattern |
|--------|-----------------|---------|
| Provider fetch status | `supabase/functions/fetch-meetings/index.ts` | Already checks active imported Fathom IDs; extend to include local title/recording UUID and a remote-change state. |
| Single-call refresh | `supabase/functions/fathom-refresh/index.ts` | Already refreshes one imported Fathom call and preserves UUID/org/owner/workspace/folder/tag/note associations. |
| Import row state | `src/components/connectors/registry/types.ts`, `src/hooks/useSyncTabOrchestration.ts`, `src/components/transcripts/UnsyncedMeetingsSection.tsx` | Replace boolean-only `synced` filtering with available/imported/updated-remotely display where needed. |
