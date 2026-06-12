# Phase 6: Launch UX + Support + RLS Hygiene - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 is the public-launch polish pass. It makes the first self-serve path coherent from signup through first connector import, adds action-first empty states, consolidates support/help into one sidebar popout, completes the simplest useful Polar upgrade path, and closes the required RLS regression gap before launch.

This phase is not a broad compliance hardening pass, not a full support-chat system, not a video academy, not a rebuild of onboarding from scratch, and not a general connector-management phase. A narrow provider-side resync affordance may be included as an optional launch-polish add-on, primarily for Fathom title changes, if planning finds it cheap and low risk.

</domain>

<decisions>
## Implementation Decisions

### First-Run Launch Path

- **D-01:** Preserve the already-designed signup path conceptually: sign in/sign up, answer a few setup questions, connect the first recorder account, complete the trial/credit-card page with an exit option, then land in the app.
- **D-02:** After trial setup completes, land the user on the first connector import page, not a generic dashboard.
- **D-03:** The first connector import page should surface the connected provider's all-time available library where possible.
- **D-04:** Show `Sync all` as the primary action for the provider library. Do not auto-import all available calls without the user's confirmation.
- **D-05:** Automatically show the main founder onboarding video once immediately after trial setup completes.
- **D-06:** The main founder video should explain the first-use process and tell the user they can sync all available calls from the connected provider.
- **D-07:** After the one-time modal is dismissed, the main video remains available through the Support popout / How It Works area.
- **D-08:** The video is an education layer, not a replacement for getting the user to the first import/sync surface.

### Empty-State CTAs

- **D-09:** Use action-first empty states. Every zero-data surface needs one primary CTA that directly creates value.
- **D-10:** Empty calls/vault surfaces should primarily say `Connect a source`.
- **D-11:** `Import transcript` can remain secondary where useful, but it should not compete with the launch-first connector path.
- **D-12:** In onboarding and launch contexts, prefer helping users populate CallVault from real calls before asking them to build structure.
- **D-13:** Empty workspaces and folders can offer create CTAs when the user is clearly managing structure.
- **D-14:** Empty contacts should primarily push toward connecting/importing calls because contacts are most valuable when derived from real recordings.

### Support Popout

- **D-15:** The Support control should live near the bottom of the sidebar above Settings, replacing or absorbing the current separate support/help actions.
- **D-16:** Clicking Support opens a small anchored popout or drawer beside that sidebar area, not a full page.
- **D-17:** The support popout action list is: `Watch the Onboarding Video`, `Take the Tour`, `How It Works`, `Support Docs`, and `Submit a Ticket`.
- **D-18:** `Support Docs` opens the docs site in a new tab/window. Planning should verify whether the correct URL is `docs.callvaultai.com` or `callvaultai.com/docs`.
- **D-19:** Ticket submission sends to `support@callvaultai.com`; Andrew is not cc'd by default.
- **D-20:** Keep ticket submission simple for Phase 6. Capture contact info plus basic available context such as current URL, user ID, org ID, workspace ID, browser/user agent, and app version/commit if easily available.
- **D-21:** Console errors, active recording ID, and ticket-type branching are optional only if they are already easy to grab from current state/window. Do not build a complex diagnostics pipeline for v1 launch.

### Billing and Upgrade Flow

- **D-22:** Use both visible locked affordances and action-attempt paywalls. Show Pro/Team capabilities in place where helpful, but trigger the Polar upgrade dialog when the user tries to use a gated feature.
- **D-23:** After successful checkout, return the user to the same gated action or surface and make it usable in the same session.
- **D-24:** Use the simplest implementation that preserves context. If exact action replay is expensive, returning to the same page with the gated control unlocked is acceptable.
- **D-25:** Avoid a separate post-upgrade success page unless Polar already requires it.

### RLS Hygiene Gate

- **D-26:** Primary RLS scope is the roadmap's 9 missing `CROSS_ORG_TABLES`: `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, and `import_routing_rules`.
- **D-27:** If stubs, fixtures, or test setup issues prevent meaningful RLS coverage, fix the minimum necessary to make the tests real.
- **D-28:** Do not turn Phase 6 into a broad compliance or security hardening pass.
- **D-29:** Adjacent security/compliance fixes are only allowed if required to satisfy the RLS gate or if they are trivial and directly launch-blocking.

### Optional Provider Resync Add-On

- **D-30:** Fold the `Resync updated Fathom call metadata` todo into Phase 6 as an optional launch-polish add-on.
- **D-31:** The primary resync direction is provider to CallVault. CallVault to provider push remains deferred.
- **D-32:** The user flow is call/import-list level: the user searches the relevant provider time frame after updating something in Fathom/Fireflies/etc., and already-imported remote-changed calls appear with a distinct refresh state.
- **D-33:** Already-synced calls with provider-side changes should not remain fully grayed out, and should not appear as brand-new green/available-to-sync calls. They need a distinct `Resync` / `Updated remotely` state and action.
- **D-34:** Only calls with detected remote changes since their last import should surface the resync state.
- **D-35:** Resync updates provider-owned fields only: provider title/name, source URL/status, provider metadata, provider transcript if changed, attendees/participants if provider-owned, and duration if provider-owned.
- **D-36:** Do not overwrite local CallVault notes, tags, folder/workspace placement, or user-added metadata.
- **D-37:** Fathom-first is acceptable. Broader connector support should be included only where provider change detection is easy and low risk.
- **D-38:** The primary Fathom scenario is provider-side title/name changes after import. CallVault should detect this and offer an optional local update, especially if the local title may have been edited.
- **D-39:** The secondary scenario is provider-side transcript/duration changes caused by trimming/cutting sections in Fathom. Support transcript/duration refresh if feasible; if expensive or risky, ship title-update resync first and defer deeper refresh.

### the agent's Discretion

- Exact empty-state copy, icon choices, and button labels are flexible as long as every empty surface has one clear primary CTA.
- Exact support popout primitive can be a popover, small drawer, or anchored menu, as long as it is located at the sidebar Support control and does not become a full page.
- Exact paywall success mechanics can follow the simplest existing Polar callback/session pattern that returns the user to context.
- Exact resync change-detection mechanics are an engineering/planning call per provider; title-change detection is the first target.

### Folded Todos

- `Resync updated Fathom call metadata` — folded as an optional Phase 6 add-on. It fits Phase 6 only as launch polish for already-imported provider calls that changed remotely; it must not expand into two-way provider sync or a broad connector-management rebuild.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope

- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, sequencing constraints, and Decisions Needed for support popout context capture.
- `.planning/REQUIREMENTS.md` — ONB-01 through ONB-05 and HRD-02 requirement definitions.
- `.planning/PROJECT.md` — self-serve launch goal, One-Click Promise, support popout requirement, and out-of-scope boundaries.
- `.planning/STATE.md` — current milestone state and accumulated decisions. Note: as of this discussion, `ROADMAP.md` marks Phase 5 complete while `STATE.md` still contains stale Phase 5 ready-to-execute text.
- `.planning/phases/05-connector-reliability-per-workspace-binding-unified-sync-tab/05-CONTEXT.md` — Phase 5 connector/status/import decisions that the optional resync add-on must respect.

### Launch UX and Frontend Patterns

- `src/CLAUDE.md` — frontend rules, Remix icons only, `motion/react`, service/hook separation, and design constraints.
- `.planning/codebase/ARCHITECTURE.md` — AppShell, pane model, service/hook separation, query invalidation, and Edge Function patterns.
- `.planning/codebase/STRUCTURE.md` — current locations for onboarding, billing, settings, import, connectors, and test files.
- `.planning/codebase/CONVENTIONS.md` — naming, imports, Zustand/TanStack Query patterns, and frontend error handling.
- `.planning/codebase/STACK.md` — locked frontend/backend stack and package-manager constraints.

### Support, Billing, Onboarding, and Empty States

- `src/components/transcript-library/EmptyStates.tsx` — existing empty-state component pattern discovered by CodeGraph.
- `src/hooks/useOnboarding.ts` — onboarding state hook discovered by CodeGraph.
- `src/components/onboarding/` — existing onboarding components and setup wizard surface.
- `src/components/billing/` — Polar billing components and upgrade UI patterns.
- `src/components/settings/` — settings/support/help surfaces and sidebar-adjacent support placement candidates.
- `src/lib/tour.ts` — existing tour trigger referenced by ONB-05.

### RLS and Test Hygiene

- `src/test/rls-regression.test.ts` — `CROSS_ORG_TABLES` gate to extend with the 9 missing tables.
- `.planning/codebase/TESTING.md` — Vitest, integration-test, and RLS regression patterns.
- `.planning/codebase/CONCERNS.md` — missing `CROSS_ORG_TABLES`, personal-folder stubs, and integration-test risks.
- `supabase/CLAUDE.md` — real-Supabase integration-test safety rules and cleanup contract.

### Connector Resync Add-On

- `.planning/phases/05-connector-reliability-per-workspace-binding-unified-sync-tab/05-CONTEXT.md` — preserve Phase 5 connector binding, future-sync-only, and import-list/source-surface decisions.
- `src/components/transcripts/SyncTab.tsx` — current import/search time-frame workflow where remote-updated calls should surface.
- `src/components/transcripts/SyncedTranscriptsSection.tsx` — synced-call display that must distinguish already-synced, resync-needed, and available-to-sync states.
- `src/services/sync-tab.service.ts` — import-list data source and likely location for remote-change comparison.
- `supabase/functions/fathom-fetch-meetings/index.ts` and related Fathom sync functions — likely first provider family for title/duration/transcript update detection.
- `supabase/functions/_shared/connector-pipeline.ts` — shared connector import/update path that resync must not misuse to move local placement or overwrite CallVault-owned data.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/components/transcript-library/EmptyStates.tsx`: existing empty-state component shape for action-first zero-data surfaces.
- `src/hooks/useOnboarding.ts`: existing onboarding state entry point for first-run decisions.
- `src/components/onboarding/`: likely home for setup questions, first-run completion state, and one-time video trigger wiring.
- `src/components/billing/`: existing Polar upgrade UI should be extended rather than rebuilt.
- `src/lib/tour.ts`: existing tour trigger should be one support popout action.
- `src/components/transcripts/SyncTab.tsx`: existing source/date import workflow should host the optional resync state if included.
- `src/components/transcripts/SyncedTranscriptsSection.tsx`: likely display boundary for already-synced vs remote-updated calls.
- `src/test/rls-regression.test.ts`: canonical RLS regression test gate.

### Established Patterns

- Frontend data access must stay service + hook separated. Components should not query Supabase directly.
- AppShell pane behavior is binding: support/help should fit existing sidebar and pane patterns rather than becoming an unrelated full-screen overlay.
- Mutation hooks that affect visible call lists must invalidate via `invalidateCallListCaches(queryClient)` on settled.
- Recording ID conversion must use `toRecordingUuid()` / `toRecordingUuidBatch()` when crossing UUID/BIGINT boundaries.
- Integration tests must use the dedicated real Supabase test project guardrails; do not mock Supabase for isolation-sensitive behavior.

### Integration Points

- Onboarding/trial completion needs a one-time founder-video modal state that then routes to the first connector import page.
- Empty states across calls, workspaces, folders, contacts, and settings need one primary CTA per surface, with data-first bias in launch contexts.
- Sidebar Support needs to absorb existing separate help/support actions into one anchored popout with five actions.
- Ticket submission likely needs a small service/Edge Function path using Resend or an existing support email function if one exists.
- Polar upgrade flow should preserve attempted-action context with the least new state machinery possible.
- RLS regression must add coverage for the 9 missing tables and only patch fixtures/stubs as needed to make those tests meaningful.
- Optional resync should compare provider-owned remote fields against last imported values and present a distinct resync state without overwriting CallVault-owned fields.

</code_context>

<specifics>
## Specific Ideas

- Main founder onboarding video is a launch-critical asset. It should show the actual first process, including syncing all provider calls and orienting users to MCP, workspaces, and organizations.
- Support popout actions should be visually a simple list, not a complex support portal.
- The docs link may be `docs.callvaultai.com` or `callvaultai.com/docs`; planning should verify the production docs URL before implementation.
- Remote-updated imported calls should not look disabled/grayed-out and should not look like brand-new available calls. They need a third state.
- Fathom resync title changes are more important than transcript/duration resync for the first version.

</specifics>

<deferred>
## Deferred Ideas

- Per-feature video prompts across major app areas are deferred to a likely Phase 07 layer unless Phase 6 planning finds a tiny reusable modal/prompt pattern.
- A richer onboarding guide/tour hub with section-by-section videos is deferred.
- Bottom-right support chat is deferred until there are enough users and support capacity.
- CallVault-to-provider push sync is deferred. Do not build title/metadata push-back to Fathom, Fireflies, or other providers in Phase 6.
- Deep transcript/duration resync for trimmed/cut provider calls may be deferred if title-update resync is the only low-risk launch add-on.

### Reviewed Todos (not folded)

- `Research compliance certifications readiness` — reviewed but not folded. Phase 6 should not expand into a certification-readiness research phase.
- `Apply 15-min compliance posture fixes (GitHub + Vercel + Supabase + Cloudflare)` — reviewed but not folded. Adjacent compliance posture fixes are only allowed if directly required by the RLS gate or trivially launch-blocking.

</deferred>

---

*Phase: 06-Launch UX + Support + RLS Hygiene*
*Context gathered: 2026-05-31*
