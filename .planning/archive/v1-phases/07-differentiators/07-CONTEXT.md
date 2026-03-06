# Phase 7: High-Value Differentiators - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Unique features that differentiate CallVault from generic transcription tools:
- PROFITS Framework v2 (psychology extraction from sales calls)
- Folder-Level Chat (scope chat to specific folders)
- Client Health Alerts (engagement tracking with outreach)
- Contacts Database (track attendees from calls)
- Real Analytics Data (wire analytics tabs to real data)

</domain>

<decisions>
## Implementation Decisions

### PROFITS Framework UX
- **Location:** Full-page report view (navigate to from call detail)
- **Trigger:** Manual per-call (user clicks "Run PROFITS Analysis")
- **Output format:** Structured sections per letter (P, R, O, F, I, T, S each have own section)
- **Evidence:** Each section includes direct quotes with citations linking back to transcript moments

### Folder-Level Chat
- **Entry point:** Filter dropdown in main chat (extends existing filter popover)
- **Scope awareness:** AI explicitly mentions scope ("Based on calls in [Folder]...")
- **Multi-select:** Users can select multiple folders to combine their calls
- **Active scope display:** Pill/badge in chat header (extends existing call pill pattern)
- **Note:** Filter infrastructure partially exists already, needs folder option added

### Client Health Alerts
- **What it tracks:** Engagement/attendance, NOT sentiment (client hasn't attended in X days/meetings)
- **Client selection:** Both manual client list AND tag-based (e.g., 'client:Acme') supported
- **Threshold config:** Global default with per-client override capability
- **Alert delivery:** Both email AND in-app notifications
- **Alert action:** "Send to chat" generates re-engagement email via AI prompt
  - Default prompt: Casual message noting they've been missed, recent call highlights, checking in
  - Users can edit/personalize the prompt template

### Contacts Database (replaces "Manual Upload")
- **Clarification:** DIFF-04 is NOT file upload - it's a contacts/people tracking feature
- **Location:** Settings > Contacts (new tab)
- **Master toggle:** "Track all contacts" vs "Manually track" (iPhone-style switch)
  - Track all: Automatically adds all attendees from all calls
  - Manual: User selects which people to add
- **Import methods:** One-click add all, per-call add, bulk checkbox select
- **Contact display:** Full profile card (name, email, all calls, tags, notes, last seen)
- **Tagging:** Can mark individuals as "Client", "Customer", or "Lead"
- **Engagement tracking:** Toggle per-contact for health alert monitoring

### Claude's Discretion
- PROFITS report visual design and styling
- Folder filter UI component details
- In-app notification presentation
- Contacts table pagination/sorting behavior
- Default threshold values for health alerts

</decisions>

<specifics>
## Specific Ideas

- PROFITS citations should be clickable, jumping to that moment in transcript
- Folder pills in chat should be removable (click X to remove filter)
- Health alert email generation should feel like a personal check-in, not automated
- The "Track all contacts" toggle should be the default-on state for new users

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 07-differentiators*
*Context gathered: 2026-01-31*
