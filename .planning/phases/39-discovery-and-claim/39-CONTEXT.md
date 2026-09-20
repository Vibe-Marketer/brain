# Phase 39: Discovery and Claim - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase lets a signed-in user discover events connected to every email they have proved they own, and lets a non-user participant claim their participation through an email invitation. Claiming exposes only event existence and the existing request-access path. It never grants recording, transcript, summary, participant-roster, or other capture content by itself. Existing organization-scoped people RPCs remain available unchanged.

</domain>

<decisions>
## Implementation Decisions

### Discovered Events Experience
- **D-01:** After an email is verified or claimed, Account Settings persistently shows “We found N events” with a **View events** action.
- **D-02:** **View events** opens a new dedicated Events page rather than a filtered Calls view or a results panel inside Settings.
- **D-03:** The Events page uses event cards. Each card may show the event date and time, how the user is connected, readable recordings, anonymous restricted-copy counts, request status, and allowed actions.
- **D-04:** Events needing an action appear first. Events already available follow. Each group is ordered newest first.
- **D-05:** A private recording's title, owner, provider, transcript, summary, and other restricted details remain hidden. A title may appear only when it comes from a recording the user can already access.

### Participation Invitations
- **D-06:** Only the recording owner may send a participation claim invitation.
- **D-07:** **Invite to claim** appears beside each eligible unclaimed participant in the recording's existing Participants section.
- **D-08:** Invitations are sent to one participant at a time. This phase does not add bulk-select or invite-everyone actions.
- **D-09:** An invitation shows its status and sent date. Manual resend becomes available after 7 days.
- **D-10:** For each invitation, the owner may optionally enable one automatic reminder. Automatic reminders are off by default and do not repeat indefinitely.
- **D-11:** The invitation recipient must come from the recording's existing participant data. There is no free-form email invitation field in this flow.

### Secure Email Claim
- **D-12:** Email ownership is proven with an expiring, single-use claim link. A second six-digit code is not required.
- **D-13:** The claim link expires after 7 days and cannot be replayed after successful use.
- **D-14:** If the link is opened while signed into an account with a different primary email, the user may add and verify the invited email on that current account, then finish the claim.
- **D-15:** If the recipient is signed out or new, the claim destination survives login or signup. Authentication then completes the claim automatically and opens the dedicated Events page.

### Claim Scope and Ongoing Discovery
- **D-16:** Proving ownership of an email claims all current participant matches for that email, not only the event that generated the invitation.
- **D-17:** The verified email continues matching future imports automatically. New matching events appear on the Events page without another claim.
- **D-18:** A future matching event creates one in-app notification. Phase 39 does not send continuing email notifications or daily email digests for new matches.
- **D-19:** A user can disconnect a claimed verified email from Settings after confirmation. Disconnecting stops future discovery and removes event visibility derived only from that email, without deleting or rewriting the original participant records.

### Locked Privacy and Identity Boundaries
- **D-20:** Discovery uses only the signed-in user's confirmed primary account email and explicitly verified email aliases. Unverified addresses, display-name similarity, organization membership, and calendar invitation alone are insufficient.
- **D-21:** A claim establishes identity and participation only. Recording content remains governed by Phase 38 policy, existing access paths, or an approved request.
- **D-22:** Phase 39 must preserve Phase 38's anonymous-copy response shape, verified-participation checks, webinar and large-event protections, and generic unavailable responses. It may not expose attendee rosters through discovery.
- **D-23:** Existing organization-scoped `get_people_summary` and `get_recordings_for_person` contracts remain intact; Phase 39 adds the caller-scoped cross-organization variant required by DISCO-01.

### the agent's Discretion
- Choose the exact route, card composition, loading skeleton, empty state, pagination strategy, and concise copy for the dedicated Events page while preserving D-01 through D-05.
- Choose additive schema, RLS, RPC, service, hook, notification, token-storage, and email implementation details that satisfy the decisions and repository constraints.
- Choose the exact reminder scheduling mechanism and cancellation behavior, provided there is at most one optional automatic reminder per invitation and manual resend is unavailable until day 7.
- Choose safe handling for expired, already-used, revoked, or superseded links using generic messages that do not confirm private event or account details.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative Project and Phase Requirements
- `.planning/PROJECT.md` — Current milestone scope, feature-branch release boundary, and verified Phase 38 foundation.
- `.planning/REQUIREMENTS.md` — Authoritative DISCO-01 through DISCO-03 requirements and still-binding ACCESS privacy requirements.
- `.planning/ROADMAP.md` — Phase 39 goal, success criteria, dependency on Phases 34 and 38, and final-milestone sequencing.
- `.planning/STATE.md` — Current Phase 39 position and accumulated operational constraints.
- `.planning/V2.2-COMPLETION-PLAN.md` — Branch isolation, production-change policy, tracking gate, and final release boundary.

### Binding Prior-Phase Decisions
- `.planning/phases/34-identity-consolidation/34-CONTEXT.md` — Verified-email ownership, identity aliases, and prohibition on name-only identity linkage.
- `.planning/phases/38-access-policy-share-link-key-migration-request-flow/38-CONTEXT.md` — Recording-policy, anonymous-copy discovery, request flow, webinar cap, and content-denial decisions.
- `.planning/phases/38-access-policy-share-link-key-migration-request-flow/38-VERIFICATION.md` — Independently verified live contracts Phase 39 must preserve.

### Source Specifications and Binding Repository Rules
- `.orca/drops/v2.2-REQUIREMENTS.md` — Original discovery and participation-claim background.
- `.orca/drops/SPEC-event-resolution-and-provenance.md` — Event, identity, participation, and access architecture background.
- `CLAUDE.md` — Product, security, verification, and git constraints applying to all runtimes.
- `src/CLAUDE.md` — Frontend service, hook, component, routing, and test conventions.
- `supabase/CLAUDE.md` — Additive migration, RLS, Edge Function, and real-database verification rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/settings/AccountTab.tsx` and `src/services/identity-alias.service.ts`: Existing primary-email and verified-alias management surface where D-01 and D-19 attach.
- `supabase/functions/confirm-email-alias-verification/index.ts`: Existing proof-of-email flow and identity-alias linkage precedent.
- `src/pages/Login.tsx`: Existing authentication redirect preservation for claim links that cross login or signup.
- `src/components/call-detail/CallParticipantsTab.tsx`: Existing participant list where the owner-only **Invite to claim** action belongs.
- `src/components/call-detail/OtherRecordingCopies.tsx` and `src/hooks/useRecordingAccess.ts`: Existing anonymous-copy and request-access behavior that event cards should reuse rather than bypass.
- `src/components/notifications/NotificationBell.tsx` and `src/hooks/useNotifications.ts`: Existing persistent in-app notification surface for invitations and future matching events.
- `supabase/functions/send-org-invite/index.ts` and the Resend integration: Existing transactional invitation-email precedent.
- Phase 38 discovery and access RPCs in `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql`: Existing verified-participant, event-size, webinar, and anonymous-payload protections.

### Established Patterns
- Services are pure asynchronous TypeScript; TanStack Query hooks wrap services; components never call services directly.
- Cross-organization visibility is granted through SECURITY DEFINER helpers and narrow caller-scoped RPCs so target-table RLS cannot accidentally widen access.
- All new tables and functions require real-database integration tests, RLS denial tests, and explicit production-project guards.
- Identity linkage requires verified evidence. Display names and unverified emails never establish ownership or participation.
- Recording IDs cross UUID and legacy BIGINT boundaries only through the existing recording-ID helpers.

### Integration Points
- Account Settings: verified-email discovery count, claim status, and disconnect control.
- App router/navigation: new dedicated Events page and claim-link destination preservation.
- Recording Participants section: owner-only invitation action and invitation status.
- Identity aliases and `call_participants`: caller-owned email matching and participation claim linkage.
- Phase 38 access services/RPCs: anonymous-copy counts and Request Access actions without exposing restricted content.
- Notifications and Resend: claim invitation, optional one-time reminder, and future-event in-app notification.

</code_context>

<specifics>
## Specific Ideas

- The high-value completion moment is a persistent “We found N events” message followed by a dedicated Events page, not a temporary toast or a hidden Calls filter.
- The Events page should feel actionable: unresolved access opportunities come first, while private details stay anonymous until an existing access path allows them.
- Claiming one verified email should solve the identity problem once for current and future matching events rather than forcing repetitive event-by-event claims.

</specifics>

<deferred>
## Deferred Ideas

- Bulk participant invitations and “invite everyone” — excluded in favor of deliberate one-person-at-a-time invitations.
- Repeating automatic reminders or account-wide reminder defaults — excluded; each invitation may opt into one reminder only.
- Ongoing email alerts or daily digests for newly discovered events — excluded; use in-app notifications in Phase 39.
- Previewing private event details before authentication — excluded by the privacy boundary.

### Reviewed Todos (not folded)
- “Apply 15-min compliance posture fixes” — generic keyword match with no Phase 39 discovery/claim connection.
- “Resync updated Fathom call metadata” — connector maintenance unrelated to verified-email discovery or participation claims.

</deferred>

---

*Phase: 39-discovery-and-claim*
*Context gathered: 2026-09-20*
