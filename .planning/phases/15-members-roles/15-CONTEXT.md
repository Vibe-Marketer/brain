# Phase 15: Members & Roles - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make workspace membership fully functional: 4-role permission system, email invite + shareable link, member management (add/remove/change role), workspace creation, workspace deletion, and advanced settings panel.

</domain>

<decisions>
## Implementation Decisions

### Role Permissions & Enforcement
- Conditional rendering based on role — hide actions the user can't take (no disabled buttons)
- DB role migration: rename `manager` to `contributor`, drop `guest`. 5→4 role alignment (Owner/Admin/Contributor/Member)
- Owner role is permanent — cannot demote self. At least one Owner must exist per workspace. Transfer ownership is a future feature.

### Invite & Join Flow
- Email invite: simple email with "Join [Workspace Name]" CTA button, link to `/join/:token` page
- Shareable link: copy-to-clipboard button generates token-based URL, expires after 7 days, anyone with link joins with Member role
- New user invite: `/join/:token` page shows sign-up form first, then auto-joins workspace after account creation
- Member removal: confirmation "Remove [Name]? Their calls will remain in the workspace." Calls stay in workspace.

### Workspace Deletion & Advanced Settings
- Deletion safeguard: type workspace name to confirm, warning about permanent data loss. Owner-only action.
- Advanced settings scope: workspace name/description edit, workspace type display (read-only), danger zone with delete button. Minimal for launch.
- Settings placement: Pane 4 when clicking workspace settings gear icon (matches Phase 11 modal vs Pane 4 rules)

### Claude's Discretion
- Role permission matrix specifics (which actions each role can perform)
- Invite email template design
- Token generation and validation approach
- Workspace creation form fields and flow
- Member list UI layout in workspace panel

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/organization-invitations.service.ts` — Invitation CRUD service
- `src/components/dialogs/WorkspaceInviteDialog.tsx` — Invite dialog component
- `src/components/panels/WorkspaceMemberPanel.tsx` — Member list panel
- `src/hooks/useTeamMembers.ts` — Team member data hook
- `src/hooks/useTeamHierarchy.ts` — Team hierarchy hook
- `src/lib/team-utils.ts` — Team utility functions
- `supabase/functions/send-org-invite/index.ts` — Email invite edge function

### Integration Points
- Workspace settings gear icon → Pane 4 advanced settings
- Member panel in sidebar or Pane 4
- `/join/:token` route for invite acceptance
- DB enum migration for role names

</code_context>

<specifics>
## Specific Ideas

- DB has 5 workspace roles — must migrate to 4 before any permission work
- Existing invite dialog and service need verification/fixing, not rebuilding
- Edge function for sending invites already exists

</specifics>

<deferred>
## Deferred Ideas

- Ownership transfer (future feature)
- Rich HTML email templates (keep simple for launch)

</deferred>

---

*Phase: 15-members-roles*
*Context gathered: 2026-03-30*
