# Phase 4: Team Collaboration - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable team creation and joining. Users can create teams, generate invite links, and new users can join via those links. The team creator gets a shareable link, and join pages are accessible at `/join/team/:token`.

</domain>

<decisions>
## Implementation Decisions

### Team Creation Flow
- Collect only team name (minimal friction, add details later)
- Modal dialog for creation (Claude's discretion, lean toward modal for single field)
- After creation, navigate to team dashboard
- Users can belong to multiple teams

### Invite Link Experience
- Both copy-link AND email invite options available
- Invite links expire after 7 days
- Join page shows: team name + who invited (social proof)
- Unauthenticated users: sign up/login, then auto-join (no second confirmation)

### Team Visibility in UI
- Teams appear in top-right dropdown (team switcher near user avatar)
- Active team context filters what data you see (calls, etc.)
- Personal workspace exists alongside team workspaces
- Clear team badge in header shows current team context

### Post-Join Experience
- Role-based permissions with three levels: Owner, Admin, Member
- Only admins can see the team member list (members see calls, not each other)
- New members land in main app with team context active

### Onboarding Flows
- **New users (no CallVault account):** Same full onboarding, but team-aware
  - Team mentioned at start ("You're invited to join [Team]") and end (confirmation)
  - Full onboarding steps including integration connection
- **Existing users:** Auto-join, stay in current context (notification shown, switch manually)
- **Incomplete onboarding:** User added to team but marked as "pending setup"
- Admins can see "pending setup" status badge on members who haven't completed onboarding

### Claude's Discretion
- Exact modal design and interaction
- Team dashboard layout and content
- Role permission specifics (what each role can/cannot do)
- Notification design for "joined team" messages
- "Pending setup" badge styling

</decisions>

<specifics>
## Specific Ideas

No specific product references mentioned. Open to standard patterns for team collaboration UX.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 04-team-collaboration*
*Context gathered: 2026-01-28*
