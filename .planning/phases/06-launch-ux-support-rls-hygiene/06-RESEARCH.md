# Phase 06: Launch UX + Support + RLS Hygiene - Research

**Researched:** 2026-05-31
**Domain:** Self-serve onboarding, import UX, support intake, billing gates, RLS regression coverage
**Confidence:** HIGH

<user_constraints>
## User Constraints from CONTEXT.md

### Locked Decisions
- First-run path stays: sign up/sign in -> setup questions -> connect first recorder -> trial/card page with exit -> app.
- After trial setup, users land on the first connector import page, not a dashboard.
- The connected provider's all-time library should be surfaced where possible; `Sync all` is the primary action, but no automatic import without confirmation.
- A founder onboarding video should show immediately after trial setup, then remain reachable from Support / How It Works.
- Empty states should be action-first with one primary CTA; empty calls/vault should push `Connect a source`, with `Import transcript` secondary only where appropriate.
- Support is a sidebar-bottom popout above Settings, replacing the current separate `Take the tour` and `How it works` buttons.
- Support actions: Watch Onboarding Video, Take the Tour, How It Works, Support Docs, Submit a Ticket.
- Support docs should open in a new tab; direct HTTP check shows `https://docs.callvaultai.com` resolves and `https://callvaultai.com/docs` does not.
- Tickets should send to `support@callvaultai.com`, without Andrew cc by default, and should attach simple context: contact info, current URL, user ID, org ID, workspace ID, browser/user agent, and app version/commit if easy.
- Billing gates should show locked affordances and paywall on action attempt; after checkout, return to the gated action/surface.
- RLS scope is the 9 missing tables from `CROSS_ORG_TABLES`: `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`.
- Optional resync add-on is provider-to-CallVault only, call/import-list level, Fathom-first, and should not overwrite local CallVault notes/tags/folder/workspace/user metadata.
- Resync primary scenario is Fathom title/name updates; transcript/duration from provider trim/cut is secondary and may be deferred if expensive.

### Agent Discretion
- Exact first-run video storage key and where the video URL is configured.
- Ticket form UI density and whether console errors/app version are included only if the current debug utilities make it cheap.
- Exact paywall component shape, provided the user can return to the triggering action after checkout.
- Whether optional resync ships in full Phase 6 or becomes a follow-up task if it threatens launch polish.

### Deferred Ideas
- Full video academy / per-feature video prompts.
- Bottom-right live support chat.
- CallVault-to-provider push sync.
- Broad compliance/security pass beyond RLS regression hygiene.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| First-run trial -> import landing | Browser/Client | Database | Existing onboarding state is client-driven with `user_profiles.onboarding_completed`; redirect target can be encoded in route/query/localStorage. |
| Founder onboarding video | Browser/Client | CDN/Static | Modal and support popout can render a configured external or public asset URL; no backend state is required beyond one-time local/session key. |
| Sync-all primary import action | Browser/Client | Edge Functions | Existing import UI already fetches provider calls and creates sync jobs; primary-action change belongs in UI orchestration. |
| Support popout | Browser/Client | Edge Functions | Anchored sidebar popout owns UX; ticket submission uses an authenticated Edge Function. |
| Ticket email | API/Backend | External Resend | Existing `send-org-invite` function provides the Resend/auth/CORS pattern. |
| Billing paywall return | Browser/Client | Edge Functions / Polar | `UpgradeButton` already supports `successPath`; gated actions can pass current route/action context. |
| RLS regression coverage | Test/Database | Supabase Auth | Existing `src/test/rls-regression.test.ts` uses real Supabase clients and should be expanded with fixtures. |
| Optional Fathom resync | Browser/Client + Edge Functions | Database | Existing `fathom-refresh` updates provider-owned fields for one call; UI needs remote-change detection and a resync affordance. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 6 can be implemented mostly by joining existing surfaces rather than building new systems. The onboarding flow already has the intended shape: `SetupWizard` requires connecting a source, then sends users to `SetupTrialUpsell`, and both skipping payment and successful checkout land on `/import`. OAuth callbacks already return incomplete-onboarding users to `/setup?source=...&connected=true`; completed users go to `/import` with connection params.

The largest UX gap is that `/import` currently auto-starts connector sync after OAuth return, while the product decision is to surface the all-time library and make `Sync all` primary but explicit. The safer plan is to route first-run users to the connected connector wizard with a one-time founder video modal and an all-time/default date-range search, then make "Sync all visible/all fetched" the primary action once results load.

Support and billing can stay light. The sidebar already has separate `Take the tour` and `How it works` actions; replace them with one `Support` popout that reuses `startTour` and `HowItWorksModal`, opens `https://docs.callvaultai.com`, and posts ticket context to a small Resend-backed Edge Function. Billing can reuse `UpgradeButton.successPath` and a compact locked-feature/paywall dialog instead of a new checkout system.

**Primary recommendation:** Treat Phase 6 as a thin launch-polish layer over existing onboarding/import/billing/support primitives, with only RLS fixture expansion and optional Fathom resync needing deeper backend work.
</research_summary>

<current_code_map>
## Current Code Map

### Onboarding and Trial
- `src/pages/SetupWizard.tsx` is the active connector-first onboarding path. It persists wizard progress in `localStorage`, requires at least one connected source, and navigates to `/setup/trial`.
- `src/pages/SetupTrialUpsell.tsx` is the trial/card page. `enterApp()` calls `completeOnboarding()` and navigates to `/import`; checkout uses `<UpgradeButton successPath="/import?trial=checkout" onCheckoutStarted={completeOnboarding}>`.
- `src/pages/OAuthCallback.tsx` routes incomplete onboarding back to `/setup?source={source}&connected=true`, otherwise to `/import` with connection params.
- `src/hooks/useOnboarding.ts` uses `user_profiles.onboarding_completed`.
- `src/components/onboarding/HowItWorksModal.tsx` already exports reusable explainer content.

### Import and Sync
- `src/pages/ImportPage.tsx` renders `ImportSourcePane` in Pane 2 and `ConnectorImportWizard`/manual surfaces in Pane 3. OAuth return currently upserts source state and invokes a connector sync function when available.
- `src/components/transcripts/SyncTab.tsx` has the date-range fetch/sync workflow with existing and unsynced lists.
- `src/hooks/useSyncTabOrchestration.ts` filters fetched calls to `!m.synced`, hiding already-imported calls. Resync needs this to become a tri-state, not a boolean-only list.
- `src/components/connectors/registry/types.ts` defines `AvailableCall.alreadyImported`; add a remote-update status here if resync ships.
- `src/components/connectors/registry/adapters/fathom.ts` maps `fetch-meetings` output to `AvailableCall`.
- `supabase/functions/fetch-meetings/index.ts` marks Fathom calls `synced` by matching `recordings.legacy_recording_id`/`source_metadata.external_id` and active `workspace_entries`.
- `supabase/functions/fathom-refresh/index.ts` already refreshes one Fathom call from provider data while preserving UUID, org, owner, workspace entries, folders, tags, notes, and created_at.

### Empty States
- `src/components/transcript-library/EmptyStates.tsx` has the main no-calls empty state. Its copy still mentions uploading a file directly; that should become connector-first, with `Connect Source` primary.
- Workspace/folder/contact empty states are scattered under `src/components/panes`, `src/components/settings`, and `src/components/contacts`; Phase 6 should touch only launch-blocking dead ends, not rewrite every empty state.

### Support
- `src/components/ui/sidebar-nav.tsx` has the exact target location: two bottom buttons above Settings. Replace them with one Support button/popout.
- `startTour` is imported from `src/lib/tour`.
- `HowItWorksModal` is already mounted from sidebar nav.
- `supabase/functions/send-org-invite/index.ts` is the best Edge Function pattern for authenticated Resend email, validation, CORS, and HTML escaping.

### Billing
- `src/components/billing/UpgradeButton.tsx` accepts `successPath`.
- `supabase/functions/polar-checkout/index.ts` validates relative `successPath` and creates the Polar success URL.
- `src/hooks/useRequirePaidPlan.ts` currently returns a billing redirect URL. For better launch UX, wrap it with a modal/inline gate that passes the current location as `successPath`.

### RLS
- `src/test/rls-regression.test.ts` already runs real Supabase auth clients and asserts cross-org isolation bidirectionally.
- Current `CROSS_ORG_TABLES` omits the 9 Phase 6 tables. The test needs both table entries and fixture rows where possible.
- Migration schemas show simple insert shapes for most missing tables:
  - `mcp_tokens`: `user_id`, `org_id`, `workspace_id`, `name`, `scope`.
  - `personal_folders` / `personal_tags`: `user_id`, `organization_id`, `name`.
  - `personal_folder_recordings` / `personal_tag_recordings`: `user_id`, folder/tag id, `recording_id`.
  - `call_notes`: `recording_id`, `workspace_id`, `user_id`, `content`.
  - `contact_folders`: `name`, `organization_id`, `user_id`.
  - `import_sources`: `user_id`, `source_app`, optional `account_email`.
  - `import_routing_rules`: now organization/workspace naming after migrations; verify final generated Supabase types before writing fixtures.
</current_code_map>

<recommended_architecture>
## Recommended Architecture

### First-Run Video and Import Landing

1. Add a one-time "post trial welcome video" modal that triggers on `/import` when onboarding just completed or checkout returned.
2. Store the dismissal in `localStorage` or `user_profiles` only if cross-device persistence is essential; local storage is enough for launch.
3. Preserve `/import?source=fathom&connected=true&sourceId=...` and select that source in `ImportPage`.
4. For first-run import, default to all-time/provider maximum where feasible and make `Sync all` the primary action. If a provider requires a bounded date range, use a wide default and label it plainly.
5. Remove automatic connector sync from OAuth return unless it is future-call background sync; historical import should remain explicit.

### Support Popout

Replace the two sidebar-bottom actions with a single anchored popout:
- `Watch Onboarding Video` opens the same video modal.
- `Take the Tour` calls `startTour()`.
- `How It Works` opens `HowItWorksModal`.
- `Support Docs` opens `https://docs.callvaultai.com` in a new tab.
- `Submit a Ticket` opens a small form in the popout or modal and calls `send-support-ticket`.

Ticket context should be intentionally small: message, optional category, user email/name if available, user ID, active org/workspace IDs, current URL/path, user agent, and app version/build env if already exposed. Skip console-log capture unless existing debug-panel plumbing makes it a simple import.

### Billing Gates

Keep the existing subscription hook and checkout function. Add a reusable `PaywallDialog` or `LockedFeatureButton` that:
- renders a locked affordance;
- opens on action attempt;
- uses `UpgradeButton` with `successPath` equal to the current route plus a small action marker;
- after return, lets the original page refetch subscription and continue the action.

### Optional Fathom Resync

Use existing `fathom-refresh` for the actual update. The new work is detection and UI:
- Have `fetch-meetings` return `recording_uuid`, current local title/duration/hash metadata, and a `remote_changed`/`sync_state` value for active imported calls.
- Start with title comparison only. Transcript/duration comparison requires fetching transcript or a stable provider update marker; defer unless the Fathom API response already includes enough cheap data.
- In the import/search list, show `Available`, `Imported`, and `Updated remotely`. Only `Updated remotely` rows are selectable for resync.
- Resync selected rows by invoking `fathom-refresh` per recording UUID, then invalidate call/import caches.

Avoid touching local fields: notes, tags, folders, workspace entries, org/user ownership, local title overrides if a future local override marker exists. Current `fathom-refresh` updates `recordings.title`, so Phase 6 should either accept provider title as provider-owned for Fathom imports or add a local override flag before broadening.
</recommended_architecture>

<common_pitfalls>
## Common Pitfalls

### Autopilot Historical Import
**What goes wrong:** OAuth return immediately imports historical calls, violating the explicit `Sync all` decision.
**How to avoid:** Separate connection success from historical import. Background future sync may remain provider-specific, but visible historical library import needs user confirmation.

### Boolean Sync State
**What goes wrong:** Already-imported calls remain hidden or gray even when the provider changed.
**How to avoid:** Add a tri-state sync status at the connector layer: available, imported, updated remotely.

### Ticket Overbuild
**What goes wrong:** Support intake becomes a chat system, debug recorder, or ticketing platform.
**How to avoid:** Launch with one authenticated form and a Resend email to support. Add a TODO for later live chat.

### RLS Test Without Rows
**What goes wrong:** Adding table names to `CROSS_ORG_TABLES` passes vacuously or fails because fixture columns do not exist.
**How to avoid:** Insert one row per org for each table where schema permits, and treat query errors as setup failures like the current test.

### Overwriting User Organization
**What goes wrong:** Resync updates local organization, workspace, folder, tags, notes, or user-managed data.
**How to avoid:** Reuse `fathom-refresh` preservation behavior and add tests around preserved associations.
</common_pitfalls>

<validation_architecture>
## Validation Architecture

### Automated
- `npm run build` for all Phase 6 changes touching app routes/components/services.
- Targeted Vitest registry/component tests:
  - `src/pages/__tests__/SetupTrialUpsell.registry.test.ts`
  - new/updated sidebar support popout test near `src/components/ui/__tests__/sidebar-nav.test.tsx`
  - connector import wizard tests for sync-all primary / no auto historical sync.
  - billing gate tests for `successPath` preservation.
- Real Supabase RLS regression:
  - `npm run test -- src/test/rls-regression.test.ts` with required Supabase test env vars.

### Manual / Browser
- Fresh signup walkthrough: signup -> setup -> connect connector -> trial page -> skip/add card path -> first import page.
- First-run video appears once after trial setup and remains reachable from Support.
- Support popout opens beside sidebar, actions work, docs opens `https://docs.callvaultai.com`, ticket sends.
- Empty calls state has one primary connector CTA and no audio/video upload promise.
- Paywall action returns to the gated surface after Polar checkout.
- Optional resync: update a Fathom title, fetch that date range, see `Updated remotely`, resync, confirm local title updates without losing notes/tags/folders/workspaces.
</validation_architecture>

<open_questions>
## Open Questions

- What exact founder video URL should ship? Plan should support an env-configured URL and a placeholder fallback.
- Should local title edits ever be protected from provider-title resync? User said they may not want to replace a local title; title-only resync should show the old/new title before applying.
- Is `import_routing_rules` final test fixture shape reflected accurately in generated Supabase types after all rename migrations? Verify before implementation.
</open_questions>
