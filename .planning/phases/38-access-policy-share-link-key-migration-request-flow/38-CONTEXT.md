# Phase 38: Access Policy, Share-Link Key Migration, Request Flow - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds recording-level access policies, privacy-safe discovery of other copies for confirmed participants, and a request, approval, denial, and revocation flow. It also migrates or bridges share links to recording UUIDs, preserves existing share, coach, and team access, and preserves `event_id` when recordings move across organizations. The phase may apply required additive Supabase production changes under the safeguards in the v2.2 completion plan. Frontend and other application changes remain isolated on `v2.2-event-resolution` until the milestone release.

</domain>

<decisions>
## Implementation Decisions

### Recording access
- **D-01:** New recordings are Private by default. Existing explicit team access and existing share links continue to work.
- **D-02:** A recording has one access level: Private, Attendees, Invitees, Organization, Anyone with link, or Public.
- **D-03:** Settings provides an account-wide default under Privacy & Access. Its initial value is Private, and each new recording inherits the current default.
- **D-04:** A recording owner can override the inherited default for an individual recording.
- **D-05:** Changing the account default affects future recordings only. Existing recordings retain their current policy.
- **D-06:** Only the recording owner can change that recording's access level.

### Participant discovery
- **D-07:** A confirmed participant may see inaccessible copies of the same meeting as anonymous numbered rows, each with a Request access action.
- **D-08:** An inaccessible row never reveals the recording owner, provider, title, transcript, or summary.
- **D-09:** Discovery is limited to confirmed participants supported by verified participation evidence. Calendar invitees and organization membership alone do not qualify.
- **D-10:** Participant discovery is disabled for provider-identified webinars and events with at least 50 confirmed participants.
- **D-11:** For those large events, access is possible only through a direct invitation or share link.

### Request and approval flow
- **D-12:** A request creates a persistent in-app notification for the owner and sends an email with a direct review link.
- **D-13:** The review shows the requester's name, verified email, meeting title and date, and the evidence connecting the requester to the meeting.
- **D-14:** A request does not include a free-form message.
- **D-15:** An approval remains active until the recording owner revokes it.
- **D-16:** Approvals, denials, and revocations are logged.
- **D-17:** A denied requester receives a notification without a private denial reason and must wait 30 days before requesting the same recording again.

### Settings presentation
- **D-18:** The account-wide default lives in Settings > Privacy & Access.
- **D-19:** The recording page has an Access button beside Share. It opens a compact panel containing the access level, active grants, pending requests, and revocation controls.
- **D-20:** The panel always displays: “This controls your recording only. Other attendees control their own copies.”
- **D-21:** Selecting Public requires confirmation.
- **D-22:** Inherited policies display “Using default: [level].” Overrides display “Custom” and provide Reset to default.

### the agent's Discretion
- Choose additive schema, RLS, RPC, service, hook, component, and email implementation details that satisfy the locked behavior and repository constraints.
- Choose internal names and the precise compact-panel composition while preserving the labels and controls above.
- Write concise notification and email copy consistent with CallVault's brand rules.
- Choose a safe UUID migration or compatibility bridge for `call_share_links`; existing tokens and current access paths must keep working.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative project and phase requirements
- `.planning/PROJECT.md` — Current milestone context, product constraints, and accepted production Supabase policy.
- `.planning/REQUIREMENTS.md` — Authoritative ACCESS-01 through ACCESS-09 and EVT-06 requirements. If older source documents differ, this file and the decisions above govern.
- `.planning/ROADMAP.md` — Phase 38 goal, success criteria, dependencies, and milestone sequencing.
- `.planning/STATE.md` — Current branch, phase position, accumulated decisions, and next action.
- `.planning/V2.2-COMPLETION-PLAN.md` — Branch isolation, additive production Supabase authorization, verification gates, and release boundary.

### Source specifications and background
- `.orca/drops/v2.2-REQUIREMENTS.md` — Original v2.2 requirement set and legacy-key risk notes.
- `.orca/drops/SPEC-event-resolution-and-provenance.md` — Event-resolution architecture and original access-policy background. Its older grant variants are superseded by `.planning/REQUIREMENTS.md` and D-15.

### Binding implementation rules
- `CLAUDE.md` — Product, safety, data-access, verification, and git constraints that apply to all runtimes.
- `src/CLAUDE.md` — Frontend-specific component, service, hook, and test conventions.
- `supabase/CLAUDE.md` — Database and Edge Function conventions, including additive migrations and real-database verification.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useSharing.ts`: Existing create, revoke, and access-log behavior for call share links. Preserve its observable behavior while moving data access behind the required service and hook boundary.
- `supabase/functions/share-call/index.ts`: Existing public share-token resolution and response handling that the UUID migration must keep compatible.
- `supabase/functions/share-call/__tests__/share-call.integration.test.ts`: Real-database share-link response matrix and regression coverage.
- `src/components/notifications/NotificationBell.tsx` and `src/hooks/useNotifications.ts`: Existing persistent in-app notification surface and query pattern.
- `src/components/panes/SettingsCategoryPane.tsx`, `src/components/panes/SettingsDetailPane.tsx`, and `src/pages/Settings.tsx`: Existing settings navigation and detail-pane patterns.
- `src/components/settings/AccountTab.tsx`: Existing user-setting control precedent.
- `src/services/data-movement.service.ts`: Existing recording movement boundary for preserving `event_id`.
- `src/lib/recording-ids.ts`: Required UUID/BIGINT boundary helpers; use `toRecordingUuid()` or `toRecordingUuidBatch()` rather than numeric coercion.
- `src/test/rls-regression.test.ts`: Mandatory RLS regression gate for access-control changes.

### Established Patterns
- Services contain pure asynchronous TypeScript data access; TanStack Query hooks wrap services; components do not call services directly.
- New database work must be additive and compatible with production data. Production migrations and Edge Function changes require target-ref, pending-set, migration-history, and post-deploy evidence.
- Integration tests use a real dedicated test Supabase project and must reject the production project reference.
- Recording content stays denied unless an existing path or an explicit new policy or grant permits it. Event membership alone never widens content access.
- Mutations call `invalidateCallListCaches(queryClient)` in `onSettled` when they can affect call-list state.

### Integration Points
- Access policy is initialized during every recording-ingest path and read by recording details, share controls, event-copy discovery, and authorization checks.
- Participant discovery joins canonical event membership to recordings without disclosing restricted fields.
- Access requests connect verified participant evidence, recording ownership, notifications, email delivery, audit history, and grant enforcement.
- `call_share_links` must reach `recordings.id` UUID directly or through a safe bridge while existing token URLs remain valid.
- `copy_recording_to_org` and `route_recording_cross_org` must retain `event_id` and preserve each copy's independent access policy.

</code_context>

<specifics>
## Specific Ideas

- Keep the per-recording control visible beside Share and compact enough to manage the policy, grants, requests, and revocations in one place.
- Treat inherited and custom values as distinct user-visible states so owners know what changing the account default will and will not affect.
- Anonymous copy rows should be numbered and actionable without leaking identity or content clues.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 38-access-policy-share-link-key-migration-request-flow*
*Context gathered: 2026-09-19*
