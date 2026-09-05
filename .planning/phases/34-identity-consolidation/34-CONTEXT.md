# Phase 34: Identity Consolidation - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Smart discuss (batch, autonomous) — this phase has real user-facing surface (IDENT-03: add/verify emails; IDENT-08: confidence visible on demand), unlike Phases 30-33's pure backend work

<domain>
## Phase Boundary

An `identities` spine reconciles `speakers` (user-scoped), `contacts` (org-scoped), and `call_participants` (recording-scoped) via a nullable `identity_id` on each — none moved or deleted, each keeps its reader. Identity resolution spans email aliases, provider participant IDs, display-name variants — never auto-links on name similarity alone (verified linkage only). A user can attach multiple owned, verified email addresses so calls under any of them resolve to one person. Every resolved speaker label carries confidence + evidence, visible on demand.

Out of scope: speaker propagation/diarization consensus (Phase 35), voiceprints (cut from milestone entirely, Andrew's decision 2026-08-31), live organizations (Phase 36).

</domain>

<decisions>
## Implementation Decisions

### Grey Area 1: Email verification mechanism — CORRECTED by research 2026-09-05
**Original recommendation was factually wrong**: Supabase Auth is one-email-per-account (`updateUser({email})` replaces the login email, doesn't add a second). Corrected design, now locked: a small custom hashed-OTP table + two new edge functions, reusing the already-live Resend integration (same one powering `send-org-invite`/`send-support-ticket`) for sending the verification email. Never touches `auth.users` or the session. On confirmation, the email is added to `identity_aliases` as verified. Never auto-verify.
**Rationale:** Reuses the existing Resend send-path (this repo's actual established pattern for transactional email) rather than fighting Supabase Auth's single-email model.

### Grey Area 2: Where the "add verified email" UI lives
**Recommended (accepted, batch default):** Account/profile settings page (wherever the existing user settings surface is in this app — the planner/researcher should locate it, e.g. near `user_settings` consumers). A simple list of verified emails with an "Add email" button, matching existing settings-page patterns in this codebase (no new page/route unless the researcher finds no suitable existing settings surface).
**Rationale:** Minimal-surface, one-click-promise aligned — extends an existing page rather than creating a new one.

### Grey Area 3: Confidence + evidence display ("visible on demand")
**Recommended (accepted, batch default):** Not a new dedicated page — a small UI affordance (tooltip/popover/badge) on a resolved speaker label showing confidence level and a one-line evidence summary ("matched via verified email" / "matched via display-name variant, medium confidence"), surfaced wherever speaker names already render in the existing recording/transcript UI. Exact component choice is implementation discretion (mirror existing tooltip/badge patterns already in this codebase's design system — Remix Icons, no Lucide, per project hard constraints).
**Rationale:** "Visible on demand" (REQUIREMENTS.md's literal wording) means available-but-not-intrusive — a hover/click affordance, not a permanently-visible dense UI addition.

### Locked (non-negotiable, from REQUIREMENTS.md/spec, not grey areas)
- `identities` + `identity_aliases` new tables; `speakers`/`contacts`/`call_participants` each gain nullable `identity_id` — none moved/deleted, existing readers unchanged.
- Verified linkage only — never auto-link on name similarity alone (IDENT-02/03).
- Multi-email: any of a user's verified emails resolves calls to the one identity.

</decisions>

<code_context>
## Existing Code Insights

To be filled by research: locate the existing user settings page/route, the existing Supabase Auth email-verification call pattern (likely already used for signup or email-change elsewhere in this codebase), and the three existing person tables' exact current schemas (`speakers`, `contacts`, `call_participants`) to plan the additive `identity_id` columns correctly.

</code_context>

<specifics>
## Specific Ideas

Multi-email onboarding moment from the original spec: "We found N events associated with your verified identities" — a genuinely valuable UX moment, but likely a LATER phase's concern (Phase 39, Discovery and Claim) rather than this phase's — this phase builds the identity spine + the ability to add/verify emails, not necessarily the full "N events found" onboarding surface. Researcher/planner should confirm scope boundary with Phase 39.

</specifics>

<deferred>
## Deferred Ideas

- Full "we found N events" onboarding moment — likely Phase 39 (Discovery and Claim), not this phase. Flagged, not built here.

</deferred>
